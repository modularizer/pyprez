"""this script can be used to launch a basic tornado static file handler to serve files for your project"""
import asyncio
import sys

import tornado.web
import tornado.ioloop


if __name__ == "__main__":
    app = tornado.web.Application([(r"/(.*)", tornado.web.StaticFileHandler, {"path": "."})])

    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    app.listen(80)
    print("go to http://localhost/pyprez.html in your browser")

    try:
        tornado.ioloop.IOLoop.current().start()
    except KeyboardInterrupt:
        tornado.ioloop.IOLoop.current().stop()
