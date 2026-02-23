import os
import uuid
import datetime
import sqlite3
from flask import Flask, request, jsonify, render_template, send_from_directory, session, redirect, url_for
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from colorthief import ColorThief
import qrcode
from PIL import Image
from io import BytesIO

os.environ['FLASK_ENV'] = 'development'
# Platform Config: Nexus Logic 2026
app = Flask(__name__, static_folder=".", template_folder=".", static_url_path="")
app.secret_key = "elite_identity_secret_key_2026" # TODO: Mover a una variable de entorno
CORS(app, resources={r"/api/*": {"origins": "*", "supports_credentials": True}}, supports_credentials=True) # TODO: Restringir a orígenes específicos para producción

# Database Configuration
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///ecards.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["UPLOAD_FOLDER"] = "uploads"
db = SQLAlchemy(app)

# Ensure folders exist for data persistence
if not os.path.exists(app.config["UPLOAD_FOLDER"]):
    os.makedirs(app.config["UPLOAD_FOLDER"])

# Models: Identity Schemas
class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    cards = db.relationship("BusinessCard", backref="owner", lazy=True)

    def __init__(self, **kwargs):
        super(User, self).__init__(**kwargs)

    def to_dict(self):
        from sqlalchemy import inspect
        mapper = inspect(self.__class__)
        return {c.name: getattr(self, c.name) for c in mapper.columns}

class BusinessCard(db.Model):
    __tablename__ = "business_cards"
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=True)
    name = db.Column(db.String(100), nullable=False)
    title = db.Column(db.String(100))
    company = db.Column(db.String(100))
    email = db.Column(db.String(120))
    phone = db.Column(db.String(20))
    website = db.Column(db.String(200))
    address = db.Column(db.String(300))
    
    primary_color = db.Column(db.String(7), default="#2D5BFF")
    bg_color = db.Column(db.String(7), default="#0B0F19")
    text_color = db.Column(db.String(7), default="#FFFFFF")
    
    logo_path = db.Column(db.String(200))
    profile_path = db.Column(db.String(200))
    template_id = db.Column(db.String(50), default="corporate")
    font_family = db.Column(db.String(100), default="'Plus Jakarta Sans', sans-serif")
    description = db.Column(db.Text)
    
    linkedin = db.Column(db.String(200))
    twitter = db.Column(db.String(200))
    instagram = db.Column(db.String(200))
    facebook = db.Column(db.String(200))
    github = db.Column(db.String(200))
    tiktok = db.Column(db.String(200))
    youtube = db.Column(db.String(200))
    whatsapp = db.Column(db.String(200))
    gallery_paths = db.Column(db.Text) 
    custom_fonts = db.Column(db.Text) # JSON or comma-sep URLs/Names
    custom_css = db.Column(db.Text) 
    bg_image_path = db.Column(db.String(200))
    font_file_path = db.Column(db.String(200))

    def __init__(self, **kwargs):
        super(BusinessCard, self).__init__(**kwargs)

    def to_dict(self):
        from sqlalchemy import inspect
        mapper = inspect(self.__class__)
        return {c.name: getattr(self, c.name) for c in mapper.columns}

def apply_migrations():
    """Safety: Dynamically injects missing columns into SQLite engine"""
    # Usar la misma ruta que SQLAlchemy para evitar discrepancias
    db_uri = app.config["SQLALCHEMY_DATABASE_URI"]
    if db_uri.startswith("sqlite:///"):
        db_path = db_uri.replace("sqlite:///", "")
        if not os.path.isabs(db_path):
            # Try instance path first (Flask default for relative sqlite)
            instance_db_path = os.path.join(app.instance_path, db_path)
            if os.path.exists(instance_db_path):
                db_path = instance_db_path
            else:
                db_path = os.path.join(app.root_path, db_path)
    
    db.create_all() # Ensure all tables are created before migrations
    
    print(f"EliteCards: Syncing Database Schema at {db_path}...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Verificar si la tabla business_cards existe
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='business_cards'")
    if not cursor.fetchone():
        print("EliteCards: Table 'business_cards' does not exist yet. Skipping migrations.")
        conn.close()
        return
    
    # Verificar y migrar tabla business_cards
    cursor.execute("PRAGMA table_info(business_cards)")
    result = cursor.fetchall()
    columns = [c[1] for c in result] if result else []
    
    required_business_cards = {
        "user_id": "VARCHAR(36)", "address": "VARCHAR(300)",
        "instagram": "VARCHAR(200)", "facebook": "VARCHAR(200)",
        "github": "VARCHAR(200)", "tiktok": "VARCHAR(200)",
        "youtube": "VARCHAR(200)", "whatsapp": "VARCHAR(200)",
        "primary_color": "VARCHAR(7)", "bg_color": "VARCHAR(7)", "text_color": "VARCHAR(7)",
        "profile_path": "VARCHAR(200)", "template_id": "VARCHAR(50)",
        "font_family": "VARCHAR(100)", "description": "TEXT",
        "gallery_paths": "TEXT", "custom_fonts": "TEXT", "custom_css": "TEXT",
        "bg_image_path": "VARCHAR(200)", "font_file_path": "VARCHAR(200)"
    }
    
    updated = False
    for col, type_info in required_business_cards.items():
        if col not in columns:
            print(f"EliteCards: Migrating Column [{col}]")
            cursor.execute(f"ALTER TABLE business_cards ADD COLUMN {col} {type_info}")
            updated = True
    
    # Verificar y migrar tabla users si existe
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
    if cursor.fetchone():
        cursor.execute("PRAGMA table_info(users)")
        user_result = cursor.fetchall()
        user_columns = [c[1] for c in user_result] if user_result else []
        
        required_users = {
            "password_hash": "VARCHAR(128)"
        }
        
        for col, type_info in required_users.items():
            if col not in user_columns:
                print(f"EliteCards: Migrating Column [{col}] in user table")
                cursor.execute(f"ALTER TABLE user ADD COLUMN {col} {type_info}")
                updated = True
            
    if updated: conn.commit()
    conn.close()
    print("EliteCards: Nexus Schema Synchronized.")

# --- CORE ROUTING ENGINE ---

@app.route("/card/<id>")
def public_card(id):
    """Stand-alone Identity Mirror"""
    card = db.session.get(BusinessCard, id)
    if not card: return "404 | IDENTITY SHADOW NOT FOUND", 404
    return render_template("index.html", card=card.to_dict())

# --- AUTH API ---

@app.route("/api/auth/register", methods=["POST"])
def register():
    if not request.is_json:
        return jsonify({"error": "JSON_REQUIRED"}), 415
    try:
        data = request.get_json()
    except Exception:
        return jsonify({"error": "BAD_REQUEST"}), 400
    if not data or "username" not in data or "password" not in data: return jsonify({"error": "BAD_REQUEST"}), 400
    if User.query.filter_by(username=data["username"]).first(): return jsonify({"error": "EXECUTIVE_EXISTS"}), 400
    user = User(username=data["username"], password_hash=generate_password_hash(data["password"]))
    db.session.add(user)
    db.session.commit()
    return jsonify({"status": "SUCCESS"})

@app.route("/api/auth/login", methods=["POST"])
def login():
    if not request.is_json:
        return jsonify({"error": "JSON_REQUIRED"}), 415
    try:
        data = request.get_json()
    except Exception:
        return jsonify({"error": "BAD_REQUEST"}), 400
    
    if not data or "username" not in data or "password" not in data:
        return jsonify({"error": "BAD_REQUEST"}), 400
    
    user = User.query.filter_by(username=data["username"]).first()
    if user and check_password_hash(user.password_hash, data["password"]):
        session["user_id"] = user.id
        return jsonify({"status": "GRANTED", "user": {"username": user.username}})
    return jsonify({"error": "DENIED"}), 401

@app.route("/api/auth/logout", methods=["POST"])
def logout():
    session.pop("user_id", None)
    return jsonify({"status": "TERMINATED"})

@app.route("/api/auth/me")
def me():
    uid = session.get("user_id")
    if not uid: return jsonify({"error": "GUEST"}), 401
    user = db.session.get(User, uid)
    if not user: return jsonify({"error": "ZOMBIE_SESSION"}), 404
    return jsonify({"user": {"username": user.username}})

# --- BUSINESS LOGIC API ---

@app.route("/api/detect-color", methods=["POST"])
def detect_color():
    if "logo" not in request.files: return jsonify({"error": "EMPTY"}), 400
    file = request.files["logo"]
    img = Image.open(file.stream).convert("RGB")
    temp_path = os.path.join(app.config["UPLOAD_FOLDER"], f"tmp_{uuid.uuid4()}.png")
    img.save(temp_path)
    try:
        color_thief = ColorThief(temp_path)
        dominant_color = color_thief.get_color(quality=3)
        return jsonify({"dominant_color": "#{:02x}{:02x}{:02x}".format(*list(dominant_color))})
    finally:
        if os.path.exists(temp_path): os.remove(temp_path)

@app.route("/api/cards", methods=["POST"])
def save_card():
    if not session.get("user_id"):
        return jsonify({"error": "AUTH_REQUIRED"}), 401
    
    data = request.form.to_dict()
    if not data or not data.get("name"):
        return jsonify({"error": "NAME_REQUIRED"}), 400
    logo = request.files.get("logo")
    uid = session.get("user_id")
    print(f"[DEBUG save_card] User ID from session: {uid}")
    print(f"[DEBUG save_card] Form data received: {data}")

    try:
        card_id = data.get("id")
        if card_id:
            card = db.session.get(BusinessCard, card_id)
            if not card:
                print(f"[DEBUG save_card] Creating new card with ID: {card_id}")
                card = BusinessCard(id=card_id, user_id=uid)
                db.session.add(card)
            elif card.user_id and card.user_id != uid:
                print(f"[DEBUG save_card] LOCKOUT: User {uid} tried to modify card {card_id} owned by {card.user_id}")
                return jsonify({"error": "LOCKOUT"}), 403
            else:
                print(f"[DEBUG save_card] Updating existing card with ID: {card_id}")
        else:
            print("[DEBUG save_card] Creating new card without pre-defined ID")
            card = BusinessCard(user_id=uid)
            db.session.add(card)

        fields = ["name", "title", "company", "email", "phone", "website", "address",
                 "primary_color", "bg_color", "text_color", "linkedin",
                 "twitter", "instagram", "facebook", "github", "tiktok",
                 "youtube", "whatsapp", "description", "template_id", "font_family",
                 "custom_fonts", "custom_css"]

        for field in fields:
            if field in data: setattr(card, field, data[field])

        # Quadruple File Upload Support (Logo, Profile, Background, Font)
        for file_key in ["logo", "profile", "bg_image", "font_file"]:
            file = request.files.get(file_key)
            if file:
                filename = f"{uuid.uuid4()}_{file.filename}"
                file_path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
                file.save(file_path)
                if file_key == "logo":
                    card.logo_path = filename
                elif file_key == "profile":
                    card.profile_path = filename
                elif file_key == "bg_image":
                    card.bg_image_path = filename
                elif file_key == "font_file":
                    card.font_file_path = filename
                print(f"[DEBUG save_card] {file_key} saved to: {file_path}")

        db.session.commit()
        print(f"[DEBUG save_card] Card saved/updated successfully: {card.to_dict()}")
        return jsonify({"status": "success", "card": card.to_dict()})
    except Exception as e:
        db.session.rollback()
        print(f"[ERROR save_card] An unexpected error occurred: {e}")
        return jsonify({"status": "error", "error": str(e)}), 500

@app.route("/api/cards/<id>", methods=["DELETE"])
def delete_card(id):
    if not session.get("user_id"):
        return jsonify({"error": "AUTH_REQUIRED"}), 401
    
    card = BusinessCard.query.filter_by(id=id, user_id=session["user_id"]).first()
    if not card:
        return jsonify({"error": "CARD_NOT_FOUND"}), 404
    
    db.session.delete(card)
    db.session.commit()
    return jsonify({"status": "success", "message": "Card deleted"})

@app.route("/api/cards", methods=["GET"])
def list_cards():
    uid = session.get("user_id")
    print(f"[DEBUG list_cards] User ID from session: {uid}")
    
    if not uid:
        return jsonify([])
    
    cards = BusinessCard.query.filter_by(user_id=uid).order_by(BusinessCard.id.desc()).all()
    print(f"[DEBUG list_cards] Number of cards found: {len(cards)}")
    print(f"[DEBUG list_cards] Cards found (first 5 IDs): {[c.id for c in cards[:5]]}")
    return jsonify([c.to_dict() for c in cards])

@app.route("/api/cards/<id>", methods=["GET"])
def get_card(id):
    card = db.session.get(BusinessCard, id)
    if not card:
        return jsonify({"error": "MISSING"}), 404
    
    # Verificar permisos: solo el propietario puede ver su tarjeta
    uid = session.get("user_id")
    if card.user_id and card.user_id != uid:
        return jsonify({"error": "FORBIDDEN"}), 403
    
    return jsonify(card.to_dict())

@app.route("/uploads/<filename>")
def uploaded_file(filename):
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename)

@app.route("/")
def index():
    """Entry point for the Identity Platform"""
    return render_template("index.html")

@app.errorhandler(404)
def handle_404(e):
    """SPA Fallback: Routes unknown paths to index.html for client-side routing"""
    if request.path.startswith("/api/"):
        return jsonify({"error": "NOT_FOUND"}), 404
    
    # Check if it's a file request that actually exists but was missed
    # (though Flask static should handle this if configured correctly)
    static_folder = app.static_folder or "."
    file_path = os.path.join(static_folder, request.path.lstrip("/"))
    if os.path.isfile(file_path):
        return send_from_directory(static_folder, request.path.lstrip("/"))
        
    return render_template("index.html")

if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        apply_migrations()
    app.run(debug=True, port=5000)
