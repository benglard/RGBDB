import cv2, base64, subprocess, os

class Video(object):

    def __init__(self, filename):
        self.filename = filename
        self.name = os.path.splitext(self.filename)[0]
        self.path = os.path.join('./uploads', self.filename)

    @property
    def desc(self):
        return {
            'fps': self.fps,
            'audio': self.audio,
            'frames': self.frames
        }

    @property
    def fps(self):
        capture = cv2.VideoCapture(self.path)
        fps = capture.get(5) #cv.CV_CAP_PROP_FPS
        capture.release()
        return int(round(fps))

    @property
    def audio(self):
        FFMPEG = '/opt/local/bin/ffmpeg -loglevel panic'
        audio = os.path.join('sounds', '{}.mp3'.format(self.name))
        cmd = '{} -i {} -vn -ac 2 -ar 44100 -ab 320k -f mp3 ./static/{}'.format(
            FFMPEG, self.path, audio)
        subprocess.call(cmd, shell=True)
        return audio

    @property
    def frames(self):
        capture = cv2.VideoCapture(self.path)
        frames = []
        while True:
            _, frame = capture.read()
            if frame == None:
                break
            else:
                frames.append(frame)

        #for n in xrange(1, len(frames)):
        for n in xrange(len(frames)):
            #prev = frames[n - 1]
            current = frames[n]
            #diff = current - prev
            #gray = cv2.cvtColor(diff, cv2.COLOR_BGR2GRAY)
            gray = cv2.cvtColor(current, cv2.COLOR_BGR2GRAY)
            blur = cv2.GaussianBlur(gray, (5, 5), 0)
            depth = blur.tolist()
            code = cv2.imencode('.png', current)[1]
            b64 = base64.encodestring(code)
            yield {
                'b64': b64,
                'depth': depth
            }
        capture.release()