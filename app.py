import uuid, os

from tornado.ioloop import IOLoop
from tornado.web import Application, RequestHandler
from tornado.websocket import WebSocketHandler
from tornado.escape import json_encode, json_decode

from lib import Video

rel = lambda *x: os.path.abspath(os.path.join(os.path.dirname(__file__), *x))

connections = {}

class Room(object):

    def __init__(self, name, clients=[]):
        self.name = name
        self.clients = clients
        self.vid = Video(name)
        self.frames = self.vid.frames

    def __repr__(self):
        return self.name

class RoomHandler(RequestHandler):

    def get(self, slug):
        self.render('room.html')

class UploadHandler(RequestHandler):

    def get(self):
        self.render("upload.html")

    def post(self):
        upload = self.request.files['file'][0]
        fname = upload['filename']
        ext = os.path.splitext(fname)[1]
        filename = str(uuid.uuid4()) + ext
        with open(os.path.join(self.settings['uploads_path'], filename), 'w') as video:
            video.write(upload['body'])

        self.redirect('/room/' + filename)

class WebSocket(WebSocketHandler):

    def open(self, ws):
        print 'WebSocket connection to {} opened from {}'.format(ws, self.request.remote_ip)
        if ws in connections:
            connections[ws].clients.append(self)
        else:
            connections[ws] = Room(ws, [self])
        self.room = connections[ws]

    def on_message(self, msg):
        print 'Received message from {}'.format(self.request.remote_ip)
        data = json_decode(msg)
        if data['msg'] == 'fps':
            fps = json_encode({
                'msg': 'fps',
                'fps': self.room.vid.fps
            })
            for client in self.room.clients:
                client.write_message(fps)
        elif data['msg'] == 'audio':
            audio = json_encode({
                'msg': 'audio',
                'audio': self.room.vid.audio
            })
            for client in self.room.clients:
                client.write_message(audio)
        elif data['msg'] == 'frame':
            d = {}
            try:
                d = next(self.room.frames)
            except StopIteration:
                d['stop'] = True
            d['msg'] = 'frame'
            frame = json_encode(d)
            for client in self.room.clients:
                client.write_message(frame)

    def on_close(self):
        print 'Websocket connection closed'
        self.room.clients.remove(self)

def main():
    settings = dict(
        template_path=rel('templates'),
        static_path=rel('static'),
        uploads_path=rel('uploads'),
        debug=True
    )

    application = Application([
        (r'/', UploadHandler),
        (r'/room/([^/]*)', RoomHandler),
        (r'/upload', UploadHandler),
        (r'/ws/([^/]*)', WebSocket),
    ], **settings)

    application.listen(address='0.0.0.0', port=8080)
    print "Started listening at port 8080."
    IOLoop.instance().start()

if __name__ == '__main__':
    main()