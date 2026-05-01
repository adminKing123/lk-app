import subprocess
import signal
import sys
import os
import time

processes = {}


def start_process(name, cmd):
    print(f"🚀 Starting {name}: {' '.join(cmd)}")
    proc = subprocess.Popen(cmd)
    processes[name] = proc
    return proc


def stop_all():
    print("\n🛑 Shutting down all processes...")

    for name, proc in processes.items():
        if proc.poll() is None:
            print(f"→ Stopping {name}")
            proc.terminate()

    for name, proc in processes.items():
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            print(f"⚠️ Force killing {name}")
            proc.kill()

    print("✅ All processes stopped")


def signal_handler(sig, frame):
    stop_all()
    sys.exit(0)


def main():
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    port = os.environ.get("PORT", "8000")

    # ----------------------------------------
    # Commands (using uv)
    # ----------------------------------------

    agent_cmd = ["uv", "run", "src/agent.py", "start"]

    api_cmd = [
        "uv",
        "run",
        "uvicorn",
        "src.token_server:app",
        "--host",
        "0.0.0.0",
        "--port",
        port,
    ]

    # ----------------------------------------
    # Start processes
    # ----------------------------------------

    start_process("agent", agent_cmd)
    start_process("api", api_cmd)

    # ----------------------------------------
    # Monitor loop
    # ----------------------------------------

    try:
        while True:
            time.sleep(2)

            for name, proc in list(processes.items()):
                if proc.poll() is not None:
                    print(f"❌ {name} exited (code {proc.returncode})")

                    if name == "agent":
                        # restart agent automatically
                        print("🔄 Restarting agent...")
                        start_process("agent", agent_cmd)
                    else:
                        # API died → shutdown everything
                        print("🔥 API died, shutting down system")
                        stop_all()
                        sys.exit(1)

    except KeyboardInterrupt:
        stop_all()


if __name__ == "__main__":
    main()
