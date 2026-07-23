import os
from app import create_app

app = create_app()

if __name__ == "__main__":
    debug_mode = os.getenv("FLASK_DEBUG", "True").lower() in ("true", "1", "t")
    port = int(os.getenv("PORT", 5000))
    app.run(debug=debug_mode, port=port)