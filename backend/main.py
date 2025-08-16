# main.py - FastAPI entry point and routes for the exam platform
from __future__ import annotations
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import FastAPI
from . import auth

from .models import (
    init_db, SessionLocal, User, Question, Answer, Result,
    MCQQuestion, MCQAnswer, LabTask, LabSubmission,
)
from .auth import router as auth_router, get_current_user, require_admin
from .ai_checker import rubric_score
from fastapi.staticfiles import StaticFiles
from starlette.responses import FileResponse
from pathlib import Path
import json, uuid

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

# File storage for hands-on labs
BASE_DIR = Path(__file__).parent
UPLOAD_DIR = BASE_DIR / "uploads"
RESOURCES_DIR = UPLOAD_DIR / "resources"      # admin-uploaded starter files
SUBMISSIONS_DIR = UPLOAD_DIR / "submissions"  # student uploads
RESOURCES_DIR.mkdir(parents=True, exist_ok=True)
SUBMISSIONS_DIR.mkdir(parents=True, exist_ok=True)

# Expose resources for download
app.mount("/static/resources", StaticFiles(directory=str(RESOURCES_DIR)), name="static-resources")

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

class UserSummary(BaseModel):
    id: int
    username: str

@app.get("/admin/userans", response_model=List[UserSummary])
def get_users_with_answers(db: Session = Depends(get_db), user: User = Depends(require_admin)):
    users = db.query(User).join(Answer, User.id == Answer.user_id).distinct().all()
    return [{"id": u.id, "username": u.username} for u in users]

class UserAnswerOut(BaseModel):
    question_id: int
    question_title: str
    response: str
    score: float
    marks: float

@app.get("/admin/userans/{user_id}", response_model=List[UserAnswerOut])
def get_user_answers(user_id: int, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    answers = (
        db.query(Answer, Question)
        .join(Question, Answer.question_id == Question.id)
        .filter(Answer.user_id == user_id)
        .all()
    )
    return [
        {
            "question_id": q.id,
            "question_title": q.title,
            "response": a.response,
            "score": a.score,
            "marks": q.marks,
        }
        for a, q in answers
    ]

# --- MCQ answers for a user ---
@app.get("/admin/userans/{user_id}/mcq")
def get_user_mcq_answers(user_id: int, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    answers = (
        db.query(MCQAnswer, MCQQuestion)
        .join(MCQQuestion, MCQAnswer.question_id == MCQQuestion.id)
        .filter(MCQAnswer.user_id == user_id)
        .all()
    )
    out = []
    for a, q in answers:
        options = json.loads(q.options_json)
        out.append({
            "question_title": q.title,
            "selected_option": options[a.selected_index] if 0 <= a.selected_index < len(options) else "",
            "correct_option": options[q.correct_index] if 0 <= q.correct_index < len(options) else "",
            "score": a.score,
            "marks": q.marks,
        })
    return out

# --- Lab submissions for a user ---
@app.get("/admin/userans/{user_id}/labs")
def get_user_lab_submissions(user_id: int, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    subs = (
        db.query(LabSubmission, LabTask)
        .join(LabTask, LabSubmission.task_id == LabTask.id)
        .filter(LabSubmission.user_id == user_id)
        .all()
    )
    out = []
    for s, t in subs:
        out.append({
            "task_title": t.title,
            "upload_filename": s.upload_filename,
            "status": s.status,
            "manual_score": s.manual_score,
            "id": s.id,
        })
    return out

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

# # GET /admin/users/{user_id}/results
# @app.get("/admin/users/{user_id}/results")
# def get_user_results(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_admin)):
#     user = db.query(User).filter(User.id == user_id).first()
#     if not user:
#         raise HTTPException(status_code=404, detail="User not found")

#     answers = db.query(Answer).filter(Answer.user_id == user_id).order_by(Answer.question_id).all()
#     mcq_answers = db.query(MCQAnswer).filter(MCQAnswer.user_id == user_id).order_by(MCQAnswer.question_id).all()
#     submissions = db.query(LabSubmission).filter(LabSubmission.user_id == user_id).order_by(LabSubmission.task_id).all()

#     return {
#         "user": user.username,
#         "answers": [{"question_id": a.question_id, "response": a.response, "score": a.score} for a in answers],
#         "mcq_answers": [{"question_id": m.question_id, "selected": m.selected_index, "score": m.score} for m in mcq_answers],
#         "lab_submissions": [{"task_id": s.task_id, "file": s.upload_filename, "score": s.manual_score} for s in submissions]
#     }

# -----------------------
# Admin: export CSV (already added below)
# -----------------------
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


# -----------------------
# MCQ: Multiple-choice questions
# -----------------------
class MCQQuestionIn(BaseModel):
    title: str
    prompt: str
    options: List[str]
    correct_index: int
    marks: float = 1.0
    is_active: bool = True

class MCQQuestionOut(BaseModel):
    id: int
    title: str
    prompt: str
    options: List[str]
    marks: float
    is_active: bool
    class Config:
        from_attributes = True

class MCQQuestionAdminOut(MCQQuestionOut):
    correct_index: int

class MCQAnswerIn(BaseModel):
    question_id: int
    selected_index: int

class MCQSubmitPayload(BaseModel):
    answers: List[MCQAnswerIn]

class MCQResultOut(BaseModel):
    total_score: float
    max_score: float
    breakdown: List[dict]

@app.post("/mcq/questions", response_model=MCQQuestionAdminOut)
def mcq_create(payload: MCQQuestionIn, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    if payload.correct_index < 0 or payload.correct_index >= len(payload.options):
        raise HTTPException(400, detail="correct_index out of range")
    q = MCQQuestion(
        title=payload.title,
        prompt=payload.prompt,
        options_json=json.dumps(payload.options, ensure_ascii=False),
        correct_index=payload.correct_index,
        marks=payload.marks,
        is_active=payload.is_active,
    )
    db.add(q)
    db.commit()
    db.refresh(q)
    return MCQQuestionAdminOut(
        id=q.id, title=q.title, prompt=q.prompt,
        options=json.loads(q.options_json), marks=q.marks, is_active=q.is_active,
        correct_index=q.correct_index
    )

@app.put("/mcq/questions/{qid}", response_model=MCQQuestionAdminOut)
def mcq_update(qid: int, payload: MCQQuestionIn, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    q = db.query(MCQQuestion).filter(MCQQuestion.id == qid).first()
    if not q:
        raise HTTPException(404, detail="MCQ Question not found")
    if payload.correct_index < 0 or payload.correct_index >= len(payload.options):
        raise HTTPException(400, detail="correct_index out of range")
    q.title = payload.title
    q.prompt = payload.prompt
    q.options_json = json.dumps(payload.options, ensure_ascii=False)
    q.correct_index = payload.correct_index
    q.marks = payload.marks
    q.is_active = payload.is_active
    db.commit()
    db.refresh(q)
    return MCQQuestionAdminOut(
        id=q.id, title=q.title, prompt=q.prompt,
        options=json.loads(q.options_json), marks=q.marks, is_active=q.is_active,
        correct_index=q.correct_index
    )

@app.get("/mcq/questions", response_model=List[MCQQuestionOut])
def mcq_list(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    qs = db.query(MCQQuestion).filter(MCQQuestion.is_active == True).order_by(MCQQuestion.id.asc()).all()
    return [
        MCQQuestionOut(
            id=q.id, title=q.title, prompt=q.prompt,
            options=json.loads(q.options_json), marks=q.marks, is_active=q.is_active
        ) for q in qs
    ]

@app.post("/mcq/submit", response_model=MCQResultOut)
def mcq_submit(payload: MCQSubmitPayload, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role not in ("student", "admin"):
        raise HTTPException(403, detail="Invalid role")
    total = 0.0
    max_total = 0.0
    breakdown = []
    for a in payload.answers:
        q = db.query(MCQQuestion).filter(MCQQuestion.id == a.question_id, MCQQuestion.is_active == True).first()
        if not q:
            raise HTTPException(400, detail=f"MCQ {a.question_id} not found or inactive")
        options = json.loads(q.options_json)
        if a.selected_index < 0 or a.selected_index >= len(options):
            raise HTTPException(400, detail=f"Selected index out of range for question {q.id}")
        is_corr = (a.selected_index == q.correct_index)
        score = q.marks if is_corr else 0.0
        ans = MCQAnswer(user_id=user.id, question_id=q.id, selected_index=a.selected_index, is_correct=is_corr, score=score)
        db.add(ans)
        total += score
        max_total += q.marks
        breakdown.append({
            "question_id": q.id, "title": q.title,
            "selected_index": a.selected_index, "is_correct": is_corr,
            "marks": q.marks, "score": score
        })
    db.add(Result(user_id=user.id, total_score=total, max_score=max_total))
    db.commit()
    return MCQResultOut(total_score=total, max_score=max_total, breakdown=breakdown)


# -----------------------
# LAB: Hands-on tasks with manual scoring
# -----------------------
class LabTaskOut(BaseModel):
    id: int
    title: str
    instructions: str
    resource_url: Optional[str] = None
    marks: float
    is_active: bool
    class Config:
        from_attributes = True

class LabSubmissionOut(BaseModel):
    id: int
    task_id: int
    username: str
    task_title: str
    upload_filename: str
    uploaded_at: str
    manual_score: Optional[float] = None
    feedback: Optional[str] = None
    status: str

@app.post("/lab/tasks", response_model=LabTaskOut)
def lab_create(
    title: str = Form(...),
    instructions: str = Form(...),
    marks: float = Form(5.0),
    is_active: bool = Form(True),
    resource: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    user: User = Depends(require_admin),
):
    saved_name = None
    mime = None
    if resource:
        ext = Path(resource.filename).suffix
        saved_name = f"{uuid.uuid4().hex}{ext}"
        dest = RESOURCES_DIR / saved_name
        with dest.open("wb") as f:
            f.write(resource.file.read())
        mime = resource.content_type
    t = LabTask(
        title=title,
        instructions=instructions,
        marks=marks,
        is_active=is_active,
        resource_filename=saved_name,
        resource_mime=mime,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return LabTaskOut(
        id=t.id, title=t.title, instructions=t.instructions,
        resource_url=(f"/lab/tasks/{t.id}/resource" if t.resource_filename else None),
        marks=t.marks, is_active=t.is_active,
    )

@app.put("/lab/tasks/{task_id}", response_model=LabTaskOut)
def lab_update(
    task_id: int,
    title: str = Form(...),
    instructions: str = Form(...),
    marks: float = Form(5.0),
    is_active: bool = Form(True),
    resource: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    user: User = Depends(require_admin),
):
    t = db.query(LabTask).filter(LabTask.id == task_id).first()
    if not t:
        raise HTTPException(404, detail="Lab task not found")
    t.title = title
    t.instructions = instructions
    t.marks = marks
    t.is_active = is_active
    if resource:
        ext = Path(resource.filename).suffix
        saved_name = f"{uuid.uuid4().hex}{ext}"
        dest = RESOURCES_DIR / saved_name
        with dest.open("wb") as f:
            f.write(resource.file.read())
        t.resource_filename = saved_name
        t.resource_mime = resource.content_type
    db.commit()
    db.refresh(t)
    return LabTaskOut(
        id=t.id, title=t.title, instructions=t.instructions,
        resource_url=(f"/lab/tasks/{t.id}/resource" if t.resource_filename else None),
        marks=t.marks, is_active=t.is_active,
    )

@app.get("/lab/tasks", response_model=List[LabTaskOut])
def lab_list(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.query(LabTask).filter(LabTask.is_active == True).order_by(LabTask.id.asc()).all()
    return [
        LabTaskOut(
            id=t.id, title=t.title, instructions=t.instructions,
            resource_url=(f"/lab/tasks/{t.id}/resource" if t.resource_filename else None),
            marks=t.marks, is_active=t.is_active
        ) for t in rows
    ]

@app.get("/lab/tasks/{task_id}/resource")
def lab_resource(task_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    t = db.query(LabTask).filter(LabTask.id == task_id, LabTask.is_active == True).first()
    if not t or not t.resource_filename:
        raise HTTPException(404, detail="Resource not found")
    path = RESOURCES_DIR / t.resource_filename
    if not path.exists():
        raise HTTPException(404, detail="File not found on server")
    # Suggest a readable filename using the task title
    safe_title = "".join(c for c in t.title if c.isalnum() or c in (" ", "-", "_")) or f"task-{t.id}"
    ext = path.suffix or ""
    return FileResponse(str(path), filename=f"{safe_title}{ext}")

@app.post("/lab/tasks/{task_id}/submit")
def lab_submit(task_id: int, file: UploadFile = File(...), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    t = db.query(LabTask).filter(LabTask.id == task_id, LabTask.is_active == True).first()
    if not t:
        raise HTTPException(404, detail="Lab task not found or inactive")
    ext = Path(file.filename).suffix
    saved_name = f"{task_id}_{user.id}_{uuid.uuid4().hex}{ext}"
    dest = SUBMISSIONS_DIR / saved_name
    with dest.open("wb") as f:
        f.write(file.file.read())
    sub = LabSubmission(
        task_id=task_id,
        user_id=user.id,
        upload_filename=saved_name,
        upload_mime=file.content_type or "",
        status="submitted",
    )
    db.add(sub)
    db.commit()
    return {"status": "ok", "submission_id": sub.id}

@app.get("/lab/submissions", response_model=List[LabSubmissionOut])
def lab_submissions(db: Session = Depends(get_db), user: User = Depends(require_admin)):
    rows = (
        db.query(LabSubmission, User.username, LabTask.title)
        .join(User, User.id == LabSubmission.user_id)
        .join(LabTask, LabTask.id == LabSubmission.task_id)
        .order_by(LabSubmission.uploaded_at.desc())
        .all()
    )
    out = []
    for sub, username, task_title in rows:
        out.append(
            LabSubmissionOut(
                id=sub.id, task_id=sub.task_id, username=username, task_title=task_title,
                upload_filename=sub.upload_filename,
                uploaded_at=(sub.uploaded_at.isoformat() if sub.uploaded_at else ""),
                manual_score=sub.manual_score, feedback=sub.feedback, status=sub.status
            )
        )
    return out

@app.get("/lab/submissions/{submission_id}/file")
def lab_download(submission_id: int, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    sub = db.query(LabSubmission).filter(LabSubmission.id == submission_id).first()
    if not sub:
        raise HTTPException(404, detail="Submission not found")
    path = SUBMISSIONS_DIR / sub.upload_filename
    if not path.exists():
        raise HTTPException(404, detail="File not found on server")
    return FileResponse(str(path), filename=sub.upload_filename)

class LabScoreIn(BaseModel):
    manual_score: float
    feedback: Optional[str] = None

@app.post("/lab/submissions/{submission_id}/score")
def lab_score(submission_id: int, body: LabScoreIn, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    sub = db.query(LabSubmission).filter(LabSubmission.id == submission_id).first()
    if not sub:
        raise HTTPException(404, detail="Submission not found")
    task = db.query(LabTask).filter(LabTask.id == sub.task_id).first()
    max_marks = task.marks if task else 100.0
    sub.manual_score = max(0.0, min(body.manual_score, max_marks))
    sub.feedback = body.feedback
    sub.status = "reviewed"
    db.commit()
    return {"status": "ok"}
@app.get("/")
def root():
    return {"status": "ok", "service": "AI Exam Platform"}
