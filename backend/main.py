# main.py - FastAPI entry point and routes for the exam platform
from __future__ import annotations
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from .models import init_db, SessionLocal, User, Question, Answer, Result
from .auth import router as auth_router, get_current_user, require_admin
from .ai_checker import rubric_score

app = FastAPI(title="AI Exam Platform", version="1.0.0")

# CORS: adjust allowed origins as needed; use * for LAN dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database
init_db()

# Include auth routes
app.include_router(auth_router)


# Schemas
class QuestionIn(BaseModel):
    title: str
    prompt: str
    expected_answer: str
    marks: float = 1.0
    is_active: bool = True

class QuestionOut(BaseModel):
    id: int
    title: str
    prompt: str
    marks: float
    is_active: bool

    class Config:
        from_attributes = True

class AnswerIn(BaseModel):
    question_id: int
    response: str

class SubmitPayload(BaseModel):
    answers: List[AnswerIn]

class ResultOut(BaseModel):
    total_score: float
    max_score: float
    breakdown: List[dict]


# Dependency

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Admin: create question
@app.post("/questions", response_model=QuestionOut)
def create_question(payload: QuestionIn, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    q = Question(
        title=payload.title,
        prompt=payload.prompt,
        expected_answer=payload.expected_answer,
        marks=payload.marks,
        is_active=payload.is_active,
    )
    db.add(q)
    db.commit()
    db.refresh(q)
    return q


# Admin: edit question
@app.put("/questions/{qid}", response_model=QuestionOut)
def update_question(qid: int, payload: QuestionIn, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    q = db.query(Question).filter(Question.id == qid).first()
    if not q:
        raise HTTPException(404, detail="Question not found")
    q.title = payload.title
    q.prompt = payload.prompt
    q.expected_answer = payload.expected_answer
    q.marks = payload.marks
    q.is_active = payload.is_active
    db.commit()
    db.refresh(q)
    return q


# Anyone logged in: list active questions
@app.get("/questions", response_model=List[QuestionOut])
def list_questions(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    qs = db.query(Question).filter(Question.is_active == True).order_by(Question.id.asc()).all()
    return qs


# Student: submit answers, AI scoring
@app.post("/submit", response_model=ResultOut)
def submit_answers(payload: SubmitPayload, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role not in ("student", "admin"):
        raise HTTPException(403, detail="Invalid role")

    # Remove any previous answers for this user for idempotent retake
    db.query(Answer).filter(Answer.user_id == user.id).delete()
    db.query(Result).filter(Result.user_id == user.id).delete()
    db.commit()

    total = 0.0
    max_total = 0.0
    breakdown = []

    for a in payload.answers:
        q = db.query(Question).filter(Question.id == a.question_id, Question.is_active == True).first()
        if not q:
            raise HTTPException(400, detail=f"Question {a.question_id} not found or inactive")
        score = rubric_score(a.response, q.expected_answer, q.marks)
        ans = Answer(user_id=user.id, question_id=q.id, response=a.response, score=score)
        db.add(ans)
        total += score
        max_total += q.marks
        breakdown.append({
            "question_id": q.id,
            "title": q.title,
            "marks": q.marks,
            "score": score,
        })

    res = Result(user_id=user.id, total_score=total, max_score=max_total)
    db.add(res)
    db.commit()

    return ResultOut(total_score=total, max_score=max_total, breakdown=breakdown)


# Admin: view results
class StudentResult(BaseModel):
    username: str
    total_score: float
    max_score: float
    created_at: str


@app.get("/admin/results", response_model=List[StudentResult])
def get_results(db: Session = Depends(get_db), user: User = Depends(require_admin)):
    rows = (
        db.query(User.username, Result.total_score, Result.max_score, Result.created_at)
        .join(Result, Result.user_id == User.id)
        .order_by(Result.created_at.desc())
        .all()
    )
    return [
        StudentResult(
            username=r[0], total_score=r[1], max_score=r[2], created_at=r[3].isoformat()
        )
        for r in rows
    ]


# Admin: export CSV
from fastapi.responses import StreamingResponse
import csv
from io import StringIO

@app.get("/admin/results.csv")
def export_csv(db: Session = Depends(get_db), user: User = Depends(require_admin)):
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(["username", "total_score", "max_score", "created_at"])
    rows = (
        db.query(User.username, Result.total_score, Result.max_score, Result.created_at)
        .join(Result, Result.user_id == User.id)
        .order_by(Result.created_at.desc())
        .all()
    )
    for r in rows:
        writer.writerow([r[0], r[1], r[2], r[3].isoformat()])
    output.seek(0)
    return StreamingResponse(output, media_type="text/csv", headers={
        "Content-Disposition": "attachment; filename=results.csv"
    })


class AdminAnswerRow(BaseModel):
    username: str
    question_id: int
    title: str
    response: str
    score: float
    marks: float
    created_at: str


@app.get("/admin/answers", response_model=List[AdminAnswerRow])
def admin_answers(db: Session = Depends(get_db), user: User = Depends(require_admin)):
    rows = (
        db.query(User.username, Question.id, Question.title, Answer.response, Answer.score, Question.marks, Answer.created_at)
        .join(Answer, Answer.user_id == User.id)
        .join(Question, Question.id == Answer.question_id)
        .order_by(Answer.created_at.desc())
        .all()
    )
    return [
        AdminAnswerRow(
            username=r[0], question_id=r[1], title=r[2], response=r[3], score=r[4], marks=r[5], created_at=r[6].isoformat()
        )
        for r in rows
    ]


@app.get("/")
def root():
    return {"status": "ok", "service": "AI Exam Platform"}
