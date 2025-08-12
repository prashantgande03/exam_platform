"""
Script to initialize the database with an admin, a student, and sample questions.
Run this ONCE after setting up the backend.
"""
from .models import init_db, SessionLocal, User, Question
from .auth import get_password_hash

def main():
    init_db()
    db = SessionLocal()
    # Add admin user
    if not db.query(User).filter_by(username="admin").first():
        admin = User(username="admin", password_hash=get_password_hash("admin123"), role="admin")
        db.add(admin)
        print("Created admin user: admin / admin123")
    # Add student user
    if not db.query(User).filter_by(username="student").first():
        student = User(username="student", password_hash=get_password_hash("student123"), role="student")
        db.add(student)
        print("Created student user: student / student123")
    # Add sample questions
    if db.query(Question).count() == 0:
        questions = [
            Question(
                title="What is Microsoft Word?",
                prompt="Explain what Microsoft Word is used for.",
                expected_answer="Microsoft Word is a word processing application used to create, edit, and format text documents.",
                marks=2.0,
            ),
            Question(
                title="Save a Document",
                prompt="How do you save a document in Microsoft Word?",
                expected_answer="Click File > Save or press Ctrl+S to save your document.",
                marks=1.0,
            ),
            Question(
                title="Formatting Text",
                prompt="Name two ways to make text bold in Microsoft Word.",
                expected_answer="Select the text and click the Bold button or press Ctrl+B.",
                marks=1.0,
            ),
        ]
        db.add_all(questions)
        print("Added sample questions.")
    db.commit()
    db.close()
    print("Sample data initialization complete.")

if __name__ == "__main__":
    main()
