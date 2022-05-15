import asyncio
import sys

import tornado.web
import tornado.ioloop


if __name__ == "__main__":
    app = tornado.web.Application([(r"/(.*)", tornado.web.StaticFileHandler, {"path": "."})])

    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    app.listen(80)

    try:
        tornado.ioloop.IOLoop.current().start()
    except KeyboardInterrupt:
        tornado.ioloop.IOLoop.current().stop()
