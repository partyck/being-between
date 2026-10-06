import hmac
import os

from flask import Flask, Response, json, redirect, request
from flask_socketio import SocketIO, disconnect, emit, join_room, leave_room

app = Flask(__name__, static_url_path="")
app.config["SECRET_KEY"] = "secret!"

socketio = SocketIO(app, cors_allowed_origins="*")

# Cloud Run can't send responses over 32 MiB, so there the videos come from a Cloud Storage bucket (`make videos`).
VIDEOS_URL = os.environ.get("VIDEOS_URL", "").rstrip("/")
CERTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "certs")

# Only the two installations can use the server. Each one opens /?deviceid=1 or /?deviceid=2, plus &key=<key> when
# $INSTALLATION_KEY is set (server/.env, README). Without the key, any client with a device id is accepted.
DEVICE_IDS = ("1", "2")
INSTALLATION_KEY = os.environ.get("INSTALLATION_KEY", "")
# the Socket.IO connection (sid) of each installation, by device id
device_sids = {}


def check_installation(device_id, key):
    """Returns why a client is not one of the installations, or None when it is."""
    if device_id not in DEVICE_IDS:
        return 'unknown device id, open "/?deviceid=1" or "/?deviceid=2"'
    if INSTALLATION_KEY and not hmac.compare_digest(str(key or "").encode(), INSTALLATION_KEY.encode()):
        return 'wrong or missing installation key, add "&key=<installation key>"'
    return None


# SOCKETS
@socketio.on("connect")
def on_connect(auth=None):
    """Accepts the two installations only, one connection each."""
    sid = request.sid  # type: ignore
    auth = auth if isinstance(auth, dict) else {}
    device_id = str(auth.get("deviceId"))
    error = check_installation(device_id, auth.get("key"))
    if error:
        print(f"refused {sid}: {error}")
        return False

    old_sid = device_sids.get(device_id)
    device_sids[device_id] = sid
    print(f"device {device_id} connected {sid}")
    if old_sid:
        # after a reload or a reconnect, the old connection stays open until its ping times out
        print(f"device {device_id} replaced {old_sid}")
        disconnect(old_sid)


@socketio.on("disconnect")
def on_disconnect():
    sid = request.sid  # type: ignore
    for device_id, device_sid in list(device_sids.items()):
        if device_sid == sid:
            del device_sids[device_id]
            print(f"device {device_id} disconnected {sid}")


# --- WebRTC Signaling Handlers (Targeted) ---


@socketio.on("join")
def on_join(data):
    """A client joins a room."""
    print("on join")
    room = data["room"]
    join_room(room)
    emit("peer_joined", {"sid": request.sid}, to=room, skip_sid=request.sid)  # type: ignore


@socketio.on("leave")
def on_leave(data):
    """A client leaves a room."""
    print("on leave")
    room = data["room"]
    leave_room(room)
    emit("peer_left", {"sid": request.sid}, to=room, skip_sid=request.sid)  # type: ignore


@socketio.on("signal")
def on_signal(data):
    print("on signal")
    emit("signal", data, to=data["room"], skip_sid=request.sid)  # type: ignore


# --- Installation sockets ---
# each web app reads its own esp32 over Web Serial and only shares these events with the other one.
# Only the two installations can connect, so everyone but the sender is the other installation.


@socketio.on("start")
def on_start(data):
    print("start ", data["deviceId"])
    socketio.emit("start", data, skip_sid=request.sid)  # type: ignore


@socketio.on("experience-started")
def on_experience_started(data):
    print("experience-started ", data["deviceId"])
    socketio.emit("experience-started", data, skip_sid=request.sid)  # type: ignore


@socketio.on("beat")
def on_beat(data):
    print("Beat from:", data["deviceId"])
    socketio.emit("motor", data, skip_sid=request.sid)  # type: ignore


# --- Fake experience videos ---
@app.route("/videos/<filename>")
def video(filename):
    if VIDEOS_URL:
        return redirect(f"{VIDEOS_URL}/{filename}")
    return app.send_static_file(f"videos/{filename}")


# --- Default Route to Serve index.html ---
@app.route("/")
def index():
    error = check_installation(request.args.get("deviceid"), request.args.get("key"))
    if error:
        return Response(response=json.dumps({"error_description": error}), status=400, mimetype="application/json")
    return app.send_static_file("index.html")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    debug = os.environ.get("DEBUG", "1") == "1"
    # The camera and Web Serial need HTTPS, so locally it uses the self-signed certificates in server/certs.
    # Cloud Run has none: it handles HTTPS itself and forwards plain HTTP to the container.
    keyfile = os.path.join(CERTS_DIR, "key.pem")
    certfile = os.path.join(CERTS_DIR, "cert.pem")
    ssl = {"keyfile": keyfile, "certfile": certfile} if os.path.exists(keyfile) and os.path.exists(certfile) else {}
    print(f"Server running on {'https' if ssl else 'http'}://0.0.0.0:{port}, debug {debug}")
    if not INSTALLATION_KEY:
        print("No INSTALLATION_KEY: any client with a device id can connect")
    socketio.run(app, debug=debug, port=port, host="0.0.0.0", **ssl)
