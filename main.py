"""Compatibility launcher for running the Flask app from PyCharm."""

from app import app


if __name__ == "__main__":
    app.run(debug=True)
