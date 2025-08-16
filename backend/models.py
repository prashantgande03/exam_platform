# models.py - SQLAlchemy models and database setup for the exam platform
from __future__ import annotations
from datetime import datetime
from typing import Optional
from sqlalchemy import create_engine, Column, Integer, String, DateTime, ForeignKey, Float, Text, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import declarative_base, relationship, sessionmaker
import os

# SQLite DB file in the backend directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'database.db')
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# User roles: 'student' or 'admin'
class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), default='student')
    created_at = Column(DateTime, default=datetime.utcnow)
    mcq_answers = relationship('MCQAnswer', backref='user', cascade='all, delete-orphan')
    lab_submissions = relationship('LabSubmission', backref='user', cascade='all, delete-orphan')

    answers = relationship('Answer', back_populates='user')
    results = relationship('Result', back_populates='user')

class Question(Base):
    __tablename__ = 'questions'
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    prompt = Column(Text, nullable=False)
    expected_answer = Column(Text, nullable=False)
    marks = Column(Float, default=1.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    answers = relationship('Answer', back_populates='question')

class Answer(Base):
    __tablename__ = 'answers'
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'))
    question_id = Column(Integer, ForeignKey('questions.id'))
    response = Column(Text, nullable=False)
    score = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship('User', back_populates='answers')
    question = relationship('Question', back_populates='answers')

class Result(Base):
    __tablename__ = 'results'
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'))
    total_score = Column(Float, default=0.0)
    max_score = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship('User', back_populates='results')


def init_db():
    """Create tables if they don't exist."""
    Base.metadata.create_all(bind=engine)


# New: MCQ models
class MCQQuestion(Base):
    __tablename__ = 'mcq_questions'
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    prompt = Column(Text, nullable=False)
    options_json = Column(Text, nullable=False)  # JSON-encoded list of options
    correct_index = Column(Integer, nullable=False)
    marks = Column(Float, default=1.0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    answers = relationship('MCQAnswer', backref='question', cascade='all, delete-orphan')


class MCQAnswer(Base):
    __tablename__ = 'mcq_answers'
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    question_id = Column(Integer, ForeignKey('mcq_questions.id'), nullable=False)
    selected_index = Column(Integer, nullable=False)
    is_correct = Column(Boolean, default=False)
    score = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# New: Hands-on Lab models
class LabTask(Base):
    __tablename__ = 'lab_tasks'
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    instructions = Column(Text, nullable=False)
    resource_filename = Column(String(512))  # stored under uploads/resources
    resource_mime = Column(String(128))
    marks = Column(Float, default=5.0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    submissions = relationship('LabSubmission', backref='task', cascade='all, delete-orphan')

class LabSubmission(Base):
    __tablename__ = 'lab_submissions'
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey('lab_tasks.id'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    upload_filename = Column(String(512), nullable=False)  # stored under uploads/submissions
    upload_mime = Column(String(128), default='')
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    manual_score = Column(Float)  # set by admin
    feedback = Column(Text)
    status = Column(String(32), default='submitted')  # submitted|reviewed
