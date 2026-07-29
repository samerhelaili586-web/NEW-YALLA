import sys
import os
import traceback

current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(current_dir)
backend_dir = os.path.join(root_dir, "backend")

if root_dir not in sys.path:
    sys.path.insert(0, root_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

try:
    from app import create_app
    app = create_app()
except Exception as e:
    from flask import Flask, jsonify
    app = Flask(__name__)
    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def catch_all(path):
        return jsonify({"error": "app_creation_error", "detail": str(e), "traceback": traceback.format_exc()}), 500
