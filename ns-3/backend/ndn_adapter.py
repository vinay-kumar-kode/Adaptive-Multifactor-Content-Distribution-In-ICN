#!/usr/bin/env python3
"""
ADE Network Intelligence - ndnSIM Trace Adapter
Parses simulation rate traces and NFD logs produced by ndn-ade-multipath.cpp
"""

import os
import time

class NdnSimTraceParser:
    def __init__(self, trace_file_path: str):
        self.trace_file_path = trace_file_path
        self.last_pos = 0

    def get_latest_metrics(self) -> dict:
        """
        Parses newly appended rows from L3RateTracer or provides default
        steady-state values if trace file is not currently generating.
        Format of L3RateTracer:
        Time  Node  FaceId  FaceDescr  Type  Packets  Kilobytes  PacketRaw  KilobytesRaw
        """
        if not os.path.exists(self.trace_file_path):
            return {
                "traceAvailable": False,
                "traceFresh": False,
                "telemetrySource": "ROOM_SIMULATOR"
            }

        interests = 0.0
        data = 0.0
        kilobytes = 0.0
        timestamps = []

        try:
            with open(self.trace_file_path, 'r') as f:
                lines = f.readlines()
                records = []
                for line in lines[-20:]:
                    parts = line.strip().split()
                    if len(parts) >= 7:
                        try:
                            timestamp = float(parts[0])
                            pkt_type = parts[4]
                            pkt_count = float(parts[5])
                            kb_count = float(parts[6])
                        except (ValueError, IndexError):
                            continue
                        timestamps.append(timestamp)
                        records.append((parts[1], pkt_type, pkt_count, kb_count))

                # Prefer the consumer node (C0 is node 0 in the scenario) so
                # packets are not counted once per hop.
                consumer_records = [record for record in records if record[0] in {"0", "C0", "Consumer"}]
                selected_records = consumer_records or records
                for _, pkt_type, pkt_count, kb_count in selected_records:
                    if 'OutInterests' in pkt_type:
                        interests += pkt_count
                    elif 'InData' in pkt_type:
                        data += pkt_count
                        kilobytes += kb_count

            if not records:
                return {
                    "traceAvailable": True,
                    "traceFresh": False,
                    "telemetrySource": "NDNSIM_TRACE_EMPTY"
                }

            interval_seconds = max(0.5, max(timestamps) - min(timestamps)) if timestamps else 0.5
            pdr = (data / max(1.0, interests)) * 100.0 if interests > 0 else 0.0
            throughput = (kilobytes * 8.0) / interval_seconds / 1000.0
            trace_age = max(0.0, time.time() - os.path.getmtime(self.trace_file_path))

            return {
                "traceAvailable": True,
                "traceFresh": trace_age <= 3.0,
                "telemetrySource": "NDNSIM_TRACE" if trace_age <= 3.0 else "NDNSIM_TRACE_STALE",
                "traceAgeSeconds": round(trace_age, 1),
                "traceWindowSeconds": round(interval_seconds, 2),
                "throughputMbps": round(max(0.0, throughput), 3),
                "pdrPercent": round(min(100.0, pdr), 1),
                "interestsSent": int(interests),
                "dataReceived": int(data),
            }
        except Exception as e:
            print(f"[!] Error reading ndnSIM trace: {e}")
            return {
                "traceAvailable": True,
                "traceFresh": False,
                "telemetrySource": "NDNSIM_TRACE_ERROR",
                "traceError": str(e)
            }
