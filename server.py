# tk_ws_control.py
# pip install websockets

import asyncio
import json
import threading
import tkinter as tk
from tkinter import ttk
import ttkbootstrap as tb
from ttkbootstrap.constants import *
import websockets

PORT_RANGE = range(8765, 8804)

class App:
    def __init__(self, root: tb.Window):
        self.root = root
        self.root.title("Browser Controller")
        self.root.geometry("700x700")

        self.loop = asyncio.new_event_loop()
        threading.Thread(target=self.loop.run_forever, daemon=True).start()

        self.servers = {}
        self.clients = {}
        self.ports_name = {}

        self.build_ui()
        self.scan()

    def build_ui(self):
        frm = tb.Frame(self.root)
        frm.pack(fill="both", expand=True, padx=10, pady=10)

        btnf = tb.Frame(frm)
        btnf.pack(fill="x", pady=5)

        tb.Button(btnf, text="刷新", command=self.refresh).pack(side="left")
        tb.Button(btnf, text="自动活跃", command=self.scroll).pack(side="left", padx=12)
        tb.Button(btnf, text="停止活跃", command=self.stop_scroll).pack(side="left")

        frame = tb.Frame(frm)
        frame.pack(fill="both", expand=True, pady=5)
        self.list_view = tb.Treeview(frame, columns=("state", "name"), show="headings", selectmode="extended")
        self.list_view.heading("state", text="状态")
        self.list_view.heading("name", text="名字")
        self.list_view.column("state", width=150, anchor="center")
        self.list_view.pack(fill="both", expand=True)

    def get_item_port(self, item):
        return self.ports_name.get(self.list_view.item(item, "values")[1])

    def selected_ports(self):
        return [ self.get_item_port(i) for i in self.list_view.selection()]
    
    def set_status(self, port, status):
        for item in self.list_view.get_children():
            if self.get_item_port(item) == port:
                self.list_view.item(item, values=(status, self.list_view.item(item, "values")[1]))
                break

    def refresh(self):
        pass
        # for i in self.list_view.get_children():
        #     self.list_view.delete(i)

        # for p, conns in self.clients.items():
        #     if conns:
        #         self.list_view.insert("", "end", values=(str(p),))

    async def ws_handler(self, ws, port):
        self.clients.setdefault(port, set()).add(ws)
        try:
            async for msg in ws:
                data = json.loads(msg)
                if data.get("type") == "init":
                    name = data.get("fb_name", "")
                    self.list_view.insert("", "end", values=("空闲", name))
                    self.ports_name[name] = port
                if data.get("type") == "status":
                    if data.get("status") == "auto":
                        self.set_status(port, "活跃中")
                    if data.get("status") == "stop":
                        self.set_status(port, "空闲")
                    print(f"Port {port} status: {data}")
        finally:
            self.clients[port].discard(ws)
            self.root.after(0, self.refresh)

    async def start_server(self, port):
        if port in self.servers:
            return
        try:
            server = await websockets.serve(
                lambda ws: self.ws_handler(ws, port),
                "127.0.0.1",
                port,
                ping_interval=20,
                ping_timeout=20
            )
            self.servers[port] = server
        except:
            pass

    def scan(self):
        for p in PORT_RANGE:
            asyncio.run_coroutine_threadsafe(
                self.start_server(p),
                self.loop
            )

    async def send(self, port, data):
        if port not in self.clients:
            return
        msg = json.dumps(data)
        await asyncio.gather(*[
            c.send(msg) for c in list(self.clients[port])
        ], return_exceptions=True)

    def scroll(self):
        for p in self.selected_ports():
            asyncio.run_coroutine_threadsafe(
                self.send(p, {"action":"scroll30"}),
                self.loop
            )

    def stop_scroll(self):
        for p in self.selected_ports():
            asyncio.run_coroutine_threadsafe(
                self.send(p, {"action":"stop_scroll"}),
                self.loop
            )


def main():
    root = tb.Window()
    App(root)
    style = ttk.Style()
    style.configure(".", font=("Microsoft YaHei UI", 10))
    style.configure("Treeview.Heading", font=("Microsoft YaHei UI", 10, "bold"))
    style.configure(
        "Treeview",
        rowheight=30   # 行高，单位是像素，可自行调大
    )
    root.mainloop()


if __name__ == "__main__":
    main()
