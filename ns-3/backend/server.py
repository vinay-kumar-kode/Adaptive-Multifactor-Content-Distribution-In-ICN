#!/usr/bin/env python3
from __future__ import annotations
"""
ADE Network Intelligence - shared real-time demonstration server.

The browser dashboard is deliberately a thin client: requests are evaluated
here so two browsers in the same room see the same cache, popularity counters,
latency, and event stream.
"""

import asyncio
import json
import os
import time
import uuid
from collections import OrderedDict
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set

try:
    from fastapi import FastAPI, WebSocket, WebSocketDisconnect
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import FileResponse, RedirectResponse
    from fastapi.staticfiles import StaticFiles
    import uvicorn
except ImportError:
    FastAPI = None

from ndn_adapter import NdnSimTraceParser


ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DASHBOARD_DIR = os.path.join(ROOT_DIR, "ade-network-intelligence")
TRACE_FILE_PATH = os.path.join(ROOT_DIR, "build", "ade-rate-trace.txt")


KNOWN_CONTENT = {
    "/video/news/segment1": {"size": 1024, "class": "HIGH"},
    "/video/sports/segment4": {"size": 1024, "class": "HIGH"},
    "/dataset/research/chunk12": {"size": 1024, "class": "MEDIUM"},
    "/iot/temperature/region1": {"size": 256, "class": "LOW"},
    "/cdn/hls/manifest.m3u8": {"size": 512, "class": "HIGH"},
}


def now_ms() -> float:
    return time.time() * 1000


@dataclass
class RoomState:
    room_id: str
    sequence: int = 0
    started_at: float = field(default_factory=time.time)
    cache_capacity: int = 6
    cache: "OrderedDict[str, Dict[str, Any]]" = field(default_factory=OrderedDict)
    popularity: Dict[str, int] = field(default_factory=dict)
    requests: List[Dict[str, Any]] = field(default_factory=list)
    interests_sent: int = 0
    data_received: int = 0
    cache_hits: int = 0
    cache_misses: int = 0
    packets_dropped: int = 0
    total_latency_ms: float = 0.0
    active_path: str = "pathA"
    scenario: str = "NORMAL"

    def metrics(self) -> Dict[str, Any]:
        successful = max(1, self.data_received)
        avg_latency = self.total_latency_ms / successful if self.data_received else 0
        elapsed_seconds = max(0.2, time.time() - self.started_at)
        throughput_mbps = (self.data_received * 1024 * 8) / elapsed_seconds / 1_000_000
        return {
            "interestsSent": self.interests_sent,
            "dataReceived": self.data_received,
            "packetsDropped": self.packets_dropped,
            "cacheHits": self.cache_hits,
            "cacheMisses": self.cache_misses,
            "cacheHitPercent": round((self.cache_hits / successful) * 100, 1) if self.data_received else 0,
            "pdrPercent": round((self.data_received / max(1, self.interests_sent)) * 100, 1),
            "lossPercent": round((self.packets_dropped / max(1, self.interests_sent)) * 100, 1),
            "avgDelayMs": round(avg_latency, 1),
            "throughputMbps": round(throughput_mbps, 3) if self.data_received else 0,
            "activePath": self.active_path,
            "scenario": self.scenario,
        }

    def snapshot(self, participants: Optional[List[str]] = None) -> Dict[str, Any]:
        return {
            "room": self.room_id,
            "participants": participants or [],
            "cache": [
                {"name": name, "hits": item["hits"], "lastAccess": item["lastAccess"]}
                for name, item in self.cache.items()
            ],
            "popularity": dict(sorted(self.popularity.items(), key=lambda item: (-item[1], item[0]))[:12]),
            "requests": self.requests[:50],
            "metrics": self.metrics(),
            "sequence": self.sequence,
        }

    def evaluate_paths(self) -> Dict[str, Any]:
        scenario_paths = {
            "pathA": {"name": "Path A (via Router R1)", "faceId": 258, "delayMs": 95 if self.scenario == "CONGESTION" else 18, "lossPercent": 6 if self.scenario == "CONGESTION" else 0.5, "linkCost": 10, "bandwidthMbps": 20, "cacheHitPercent": 12, "queueCongestionPercent": 90 if self.scenario == "CONGESTION" else 10},
            "pathB": {"name": "Path B (via Router R2)", "faceId": 259, "delayMs": 35, "lossPercent": 15 if self.scenario == "LOSS" else 0, "linkCost": 15, "bandwidthMbps": 10, "cacheHitPercent": 25, "queueCongestionPercent": 40 if self.scenario == "LOSS" else 5},
            "pathC": {"name": "Path C (via Router R3 - Edge Cache)", "faceId": 260, "delayMs": 12 if self.scenario == "CACHE" else 45, "lossPercent": 0, "linkCost": 20, "bandwidthMbps": 8, "cacheHitPercent": 92 if self.scenario == "CACHE" else 80, "queueCongestionPercent": 8},
        }
        weights = {"delayMs": 0.30, "lossPercent": 0.25, "linkCost": 0.15, "bandwidthMbps": 0.10, "cacheHitPercent": 0.15, "queueCongestionPercent": 0.05}
        bounds = {key: (min(item[key] for item in scenario_paths.values()), max(item[key] for item in scenario_paths.values())) for key in weights}
        scores = {}
        for path_id, path in scenario_paths.items():
            def cost(key: str) -> float:
                low, high = bounds[key]
                if high == low:
                    return 0.5
                if key in {"bandwidthMbps", "cacheHitPercent"}:
                    return (high - path[key]) / (high - low)
                return (path[key] - low) / (high - low)
            scores[path_id] = round(sum(weights[key] * cost(key) for key in weights) * 100, 1)
            path["score"] = scores[path_id]
        selected = min(scores, key=scores.get)
        self.active_path = selected
        return {"paths": scenario_paths, "scores": scores, "selected": selected}

    def request(self, content_name: str, participant: str) -> Dict[str, Any]:
        normalized = "/" + content_name.strip().lstrip("/")
        if len(normalized) < 2 or len(normalized) > 180 or " " in normalized:
            raise ValueError("Use an NDN name such as /video/news/segment1")

        self.sequence += 1
        self.interests_sent += 1
        self.popularity[normalized] = self.popularity.get(normalized, 0) + 1
        is_hit = normalized in self.cache
        metadata = KNOWN_CONTENT.get(normalized, {"size": 1024, "class": "NEW"})
        evaluation = self.evaluate_paths()
        selected_path = "pathC" if is_hit else evaluation["selected"]
        self.active_path = selected_path
        selected = evaluation["paths"][selected_path]

        base_latency = {"NORMAL": 18.0, "CONGESTION": 95.0, "LOSS": 38.0}.get(self.scenario, 18.0)
        if is_hit:
            latency = 7.0 + (self.popularity[normalized] % 3)
            self.cache_hits += 1
            self.cache[normalized]["hits"] += 1
            self.cache[normalized]["lastAccess"] = time.time()
            self.cache.move_to_end(normalized)
            status = "CACHE_HIT"
            source = "Router R3 (ContentStore)"
        else:
            latency = base_latency + (self.sequence % 5)
            self.cache_misses += 1
            status = "CACHE_MISS"
            source = "Producer P0"
            self.cache[normalized] = {"hits": 0, "lastAccess": time.time()}
            self.cache.move_to_end(normalized)
            while len(self.cache) > self.cache_capacity:
                least_popular = min(self.cache, key=lambda name: (self.popularity.get(name, 0), self.cache[name]["lastAccess"]))
                del self.cache[least_popular]

        self.data_received += 1
        self.total_latency_ms += latency
        factor_values = [
            {"label": "Delay", "value": f"{selected['delayMs']} ms"},
            {"label": "Loss", "value": f"{selected['lossPercent']}%"},
            {"label": "Bandwidth", "value": f"{selected['bandwidthMbps']} Mbps"},
            {"label": "Cache value", "value": f"{selected['cacheHitPercent']}%"},
            {"label": "Queue", "value": f"{selected['queueCongestionPercent']}%"},
            {"label": "Score", "value": f"{selected['score']}"},
        ]
        decision = {
            "pathId": selected_path,
            "pathName": selected["name"],
            "faceId": selected["faceId"],
            "factors": factor_values,
            "scores": evaluation["scores"],
            "reason": "The name was already popular in the ContentStore, so Router R3 returned it locally." if is_hit else f"{selected['name']} had the lowest weighted ADE cost ({selected['score']}) for the current delay, loss, bandwidth, cache, and queue conditions.",
        }
        item = {
            "id": self.sequence,
            "time": round(time.time() - self.started_at, 2),
            "name": normalized,
            "consumer": participant,
            "router": "R0",
            "face": f"Face {selected['faceId']}",
            "path": selected["name"],
            "pathId": selected_path,
            "source": source,
            "status": status,
            "latencyMs": round(latency, 1),
            "sizeBytes": metadata["size"],
            "popularity": self.popularity[normalized],
            "cacheOccupancy": len(self.cache),
            "decision": decision,
        }
        self.requests.insert(0, item)
        self.requests = self.requests[:50]
        return {"request": item, "metrics": self.metrics(), "cache": self.snapshot()["cache"], "decision": decision}


class SharedRooms:
    def __init__(self) -> None:
        self.rooms: Dict[str, RoomState] = {}
        self.connections: Dict[str, Set[WebSocket]] = {}
        self.participants: Dict[WebSocket, Dict[str, str]] = {}

    def get_room(self, room_id: str) -> RoomState:
        room_key = (room_id or "ADE-DEMO").strip().upper()[:32] or "ADE-DEMO"
        if room_key not in self.rooms:
            self.rooms[room_key] = RoomState(room_key)
        return self.rooms[room_key]

    async def join(self, websocket: WebSocket, room_id: str, participant: str) -> RoomState:
        room = self.get_room(room_id)
        self.connections.setdefault(room.room_id, set()).add(websocket)
        self.participants[websocket] = {
            "room": room.room_id,
            "name": (participant or "Anonymous").strip()[:32] or "Anonymous",
            "id": uuid.uuid4().hex[:8],
        }
        return room

    def leave(self, websocket: WebSocket) -> None:
        details = self.participants.pop(websocket, None)
        if details:
            peers = self.connections.get(details["room"], set())
            peers.discard(websocket)

    def room_participants(self, room_id: str) -> List[str]:
        return sorted({details["name"] for details in self.participants.values() if details["room"] == room_id})

    async def send(self, websocket: WebSocket, payload: Dict[str, Any]) -> None:
        await websocket.send_text(json.dumps(payload))

    async def broadcast(self, room_id: str, payload: Dict[str, Any]) -> None:
        dead = []
        for websocket in list(self.connections.get(room_id, set())):
            try:
                await self.send(websocket, payload)
            except Exception:
                dead.append(websocket)
        for websocket in dead:
            self.leave(websocket)


if FastAPI is not None:
    app = FastAPI(title="ADE Shared Network Simulator", version="2.0.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.mount("/dashboard", StaticFiles(directory=DASHBOARD_DIR, html=True), name="dashboard")
    rooms = SharedRooms()
    trace_parser = NdnSimTraceParser(TRACE_FILE_PATH)

    def telemetry_for_room(room: RoomState) -> Dict[str, Any]:
        metrics = room.metrics()
        trace_metrics = trace_parser.get_latest_metrics()
        if trace_metrics.get("traceAvailable"):
            for key in ("throughputMbps", "pdrPercent", "interestsSent", "dataReceived"):
                if key in trace_metrics:
                    metrics[key] = trace_metrics[key]
            metrics.update({
                "traceAvailable": True,
                "traceFresh": trace_metrics.get("traceFresh", False),
                "telemetrySource": trace_metrics.get("telemetrySource", "NDNSIM_TRACE"),
                "traceAgeSeconds": trace_metrics.get("traceAgeSeconds"),
                "traceWindowSeconds": trace_metrics.get("traceWindowSeconds"),
            })
        else:
            metrics["traceAvailable"] = False
            metrics["traceFresh"] = False
            metrics["telemetrySource"] = "ROOM_SIMULATOR"
        return metrics

    @app.get("/")
    async def home() -> RedirectResponse:
        return RedirectResponse(url="/dashboard/")

    @app.get("/api/status")
    async def get_status() -> Dict[str, Any]:
        return {
            "status": "RUNNING",
            "backend": "ADE Shared Simulator / ndnSIM adapter",
            "mode": "SHARED_REAL_TIME",
            "rooms": len(rooms.rooms),
            "clients": len(rooms.participants),
            "trace_exists": os.path.exists(TRACE_FILE_PATH),
            "telemetry_source": telemetry_for_room(rooms.get_room("ADE-DEMO")).get("telemetrySource"),
            "timestamp": time.time(),
        }

    @app.get("/api/metrics")
    async def get_metrics() -> Dict[str, Any]:
        return telemetry_for_room(rooms.get_room("ADE-DEMO"))

    @app.websocket("/ws")
    async def websocket_endpoint(websocket: WebSocket) -> None:
        await websocket.accept()
        room_id = "ADE-DEMO"
        participant = "Anonymous"
        room = await rooms.join(websocket, room_id, participant)
        try:
            state = room.snapshot(rooms.room_participants(room.room_id))
            state["metrics"] = telemetry_for_room(room)
            await rooms.send(websocket, {"type": "ROOM_STATE", "state": state})
            while True:
                try:
                    raw = await asyncio.wait_for(websocket.receive_text(), timeout=0.5)
                    message = json.loads(raw)
                    message_type = message.get("type")

                    if message_type == "HELLO":
                        old_room = room.room_id
                        rooms.leave(websocket)
                        room = await rooms.join(websocket, message.get("room", old_room), message.get("participant", participant))
                        state = room.snapshot(rooms.room_participants(room.room_id))
                        state["metrics"] = telemetry_for_room(room)
                        await rooms.send(websocket, {"type": "ROOM_STATE", "state": state})
                        await rooms.broadcast(room.room_id, {"type": "PARTICIPANTS", "participants": rooms.room_participants(room.room_id)})
                    elif message_type == "REQUEST":
                        details = rooms.participants.get(websocket, {})
                        result = room.request(message.get("name", ""), details.get("name", participant))
                        result["metrics"] = telemetry_for_room(room)
                        await rooms.broadcast(room.room_id, {
                            "type": "REQUEST_RESULT",
                            "result": result,
                            "participants": rooms.room_participants(room.room_id),
                        })
                    elif message_type == "SCENARIO":
                        scenario = str(message.get("scenario", "NORMAL")).upper()
                        room.scenario = scenario if scenario in {"NORMAL", "CONGESTION", "LOSS", "CACHE"} else "NORMAL"
                        await rooms.broadcast(room.room_id, {"type": "SCENARIO_UPDATE", "scenario": room.scenario})
                except asyncio.TimeoutError:
                    await rooms.send(websocket, {
                        "type": "TELEMETRY_UPDATE",
                        "timestamp": time.time(),
                        **telemetry_for_room(room),
                        "participants": rooms.room_participants(room.room_id),
                    })
        except (WebSocketDisconnect, RuntimeError, ValueError):
            rooms.leave(websocket)
        except Exception:
            rooms.leave(websocket)

    def run_server() -> None:
        print("[+] ADE shared simulator: http://0.0.0.0:8000/dashboard/")
        print("[+] On another device use: http://<this-computer-ip>:8000/dashboard/")
        uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
else:
    import http.server
    import socketserver

    class StandaloneHandler(http.server.SimpleHTTPRequestHandler):
        def do_GET(self):
            if self.path == "/api/status":
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "STANDALONE_FALLBACK", "message": "Install backend requirements for shared WebSocket mode."}).encode("utf-8"))
            else:
                if self.path in {"/dashboard", "/dashboard/", "/dashboard/index.html"}:
                    self.path = "/ade-network-intelligence/index.html"
                elif self.path.startswith("/dashboard/"):
                    self.path = "/ade-network-intelligence/" + self.path[len("/dashboard/"):]
                super().do_GET()

    def run_server() -> None:
        print("[!] FastAPI is not installed. Run: pip install -r backend/requirements.txt")
        with socketserver.TCPServer(("", 8000), StandaloneHandler) as httpd:
            httpd.serve_forever()


if __name__ == "__main__":
    run_server()
