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

PORT_RANGE = range(8765, 8769)

# 防止系统进入睡眠
import ctypes, atexit

ES_CONTINUOUS = 0x80000000
ES_SYSTEM_REQUIRED = 0x00000001
ES_DISPLAY_REQUIRED = 0x00000002

ctypes.windll.kernel32.SetThreadExecutionState(
    ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_DISPLAY_REQUIRED
)

atexit.register(
    lambda: ctypes.windll.kernel32.SetThreadExecutionState(ES_CONTINUOUS)
)


class App:
    def __init__(self, root: tb.Window):
        self.root = root
        self.root.title("FB账号活跃")
        self.root.geometry("700x700")

        self.loop = asyncio.new_event_loop()
        threading.Thread(target=self.loop.run_forever, daemon=True).start()

        self.servers = {}
        self.clients = {}
        self.ports_name = {}
        self.ports = {}

        self.build_ui()
        self.scan()
        self.loop.create_task(self.heartbeat())

    def build_ui(self):
        frm = tb.Frame(self.root)
        frm.pack(fill="both", expand=True, padx=10, pady=10)

        btnf = tb.Frame(frm)
        btnf.pack(fill="x", pady=5)

        tb.Button(btnf, text="刷新", command=self.refresh).pack(side="left", padx=6)
        tb.Button(btnf, text="自动活跃", command=self.scroll).pack(side="left", padx=6)
        tb.Button(btnf, text="活跃Reels", command=self.auto_reels).pack(side="left", padx=6)
        tb.Button(btnf, text="停止活跃", command=self.stop_scroll).pack(side="left", padx=6)

        frame = tb.Frame(frm)
        frame.pack(fill="both", expand=True, pady=5)

        self.list_view = tb.Treeview(
            frame,
            columns=("state", "name"),
            show="headings",
            selectmode="extended"
        )

        self.list_view.heading("state", text="状态")
        self.list_view.heading("name", text="名字")
        self.list_view.column("state", width=150, anchor="center")

        yscroll = tb.Scrollbar(frame, orient="vertical", command=self.list_view.yview)
        self.list_view.configure(yscrollcommand=yscroll.set)

        self.list_view.pack(side="left", fill="both", expand=True)
        yscroll.pack(side="right", fill="y")

    def remove_client(self, client_id):
        self.clients.pop(client_id, None)
        self.ports.pop(client_id, None)

        self.ports_name = {
            k: v for k, v in self.ports_name.items()
            if v != client_id
        }

        self.root.after(0, lambda: self._remove_client_ui(client_id))

    def _remove_client_ui(self, client_id):
        for item in self.list_view.get_children():
            if self.get_item_id(item) == client_id:
                self.list_view.delete(item)
                break

    def get_item_id(self, item):
        return self.ports_name.get(self.list_view.item(item, "values")[1])
    
    def get_item_name(self,item):
        return self.list_view.item(item,"values")[1]

    def selected_ports(self):
        return [ self.get_item_id(i) for i in self.list_view.selection()]
    
    def get_item_target(self,item):
        name = self.list_view.item(item,"values")[1]
        return self.ports_name.get(name)

    def selected_targets(self):
        return [self.get_item_target(i) for i in self.list_view.selection()]

    def set_status(self, client_id, status):
        for item in self.list_view.get_children():
            if self.get_item_id(item) == client_id:
                self.list_view.item(item, values=(status, self.list_view.item(item, "values")[1]))
                break

    def delete_by_name(self, fb_name: str):
        client_id = self.ports_name.pop(fb_name, None)
        if not client_id:
            return

        # 删数据
        self.clients.pop(client_id, None)
        self.ports.pop(client_id, None)

        # 删UI
        for item in self.list_view.get_children():
            if self.get_item_name(item) == fb_name:
                self.list_view.delete(item)
                break

    def refresh(self):
        dead_clients = []

        # 检测关闭连接
        for client_id, ws in list(self.clients.items()):
            if ws.close_code is not None:
                dead_clients.append(client_id)

        # 移除失效客户端
        for client_id in dead_clients:
            self.remove_client(client_id)

        # 清理UI孤儿项
        for item in list(self.list_view.get_children()):
            name = self.get_item_name(item)
            client_id = self.ports_name.get(name)

            if client_id not in self.clients:
                self.list_view.delete(item)

    async def ws_handler(self, ws, port):
        client_id = None
        try:
            async for msg in ws:
                data = json.loads(msg)

                client_id = data.get("client_id", "")
                if data.get("type") == "init":
                    name = data.get("fb_name","")
                    if not client_id:
                        continue
                    self.delete_by_name(name)
                    self.clients[client_id] = ws
                    self.list_view.insert("", "end", values=("空闲", name))
                    self.ports_name[name] = client_id
                    self.ports[client_id] = port

                if data.get("type") == "status":
                    if data.get("status") == "auto":
                        self.set_status(client_id,"活跃中")

                    if data.get("status") == "stop":
                        self.set_status(client_id,"空闲")
        except websockets.exceptions.ConnectionClosedError:
            print("客户端断开连接")
        except websockets.exceptions.InvalidMessage:
            print("收到非法 WebSocket 请求")
        finally:
            if client_id:
                self.remove_client(client_id)

    async def start_server(self, port):
        if port in self.servers:
            return
        try:
            server = await websockets.serve(lambda ws: self.ws_handler(ws, port), "127.0.0.1", port)
            self.servers[port] = server
        except Exception as e:
            print(f"启动端口 {port} 失败: {e}")

    def scan(self):
        for p in PORT_RANGE:
            asyncio.run_coroutine_threadsafe(
                self.start_server(p),
                self.loop
            )

    async def send(self,port,client_id,data):
        ws = self.clients.get(client_id)
        if ws:
            await ws.send(json.dumps(data))

    def scroll(self):
        for client_id in self.selected_targets():
            port = self.ports.get(client_id)
            if port is not None:
                asyncio.run_coroutine_threadsafe(
                    self.send(port,client_id,{"action":"scroll30"}),
                    self.loop
                )
    def auto_reels(self):
        for client_id in self.selected_targets():
            port = self.ports.get(client_id)
            if port is not None:
                asyncio.run_coroutine_threadsafe(
                    self.send(port,client_id,{"action":"auto_reels"}),
                    self.loop
                )
    def stop_scroll(self):
        for client_id in self.selected_targets():
            port = self.ports.get(client_id)
            if port is not None:
                asyncio.run_coroutine_threadsafe(
                    self.send(port,client_id,{"action":"stop_scroll"}),
                    self.loop
                )

    # ===== 心跳协程 =====
    async def heartbeat(self):
        while True:
            await asyncio.sleep(15)

            dead = []

            for client_id, ws in list(self.clients.items()):
                try:
                    pong = await ws.ping()
                    await asyncio.wait_for(pong, timeout=5)
                except:
                    dead.append(client_id)

            for client_id in dead:
                self.remove_client(client_id)

                for item in self.list_view.get_children():
                    if self.get_item_id(item) == client_id:
                        self.list_view.delete(item)
                        break


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
