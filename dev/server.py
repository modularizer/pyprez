"""this script can be used to launch a basic tornado static file handler to serve files for your project
if you want to locally host the pyprez.js file instead of retrieving it from
https://modularizer.github.io/pyprez/pyprez.js
"""
import asyncio
import sys
import os

import tornado.web
import tornado.ioloop

os.chdir(os.path.dirname(os.path.dirname(__file__)))
print(os.getcwd())


class RedirectHandler(tornado.web.RequestHandler):
    """main handler for requests to the base url"""
    def initialize(self, homepage) -> None:
        """function which initializes the handler and sets the homepage"""
        self.homepage = homepage

    def get(self):
        """redirects the landing page to the home page"""
        self.redirect(self.homepage)


if __name__ == "__main__":
    app = tornado.web.Application([
        (r"/", RedirectHandler, {"homepage": "/index.html"}),
        (r"/(.*)", tornado.web.StaticFileHandler, {"path": "./site"}),
        (r"/sample_imgs/(.*)", tornado.web.StaticFileHandler, {"path": "./sample_imgs"})
    ])

    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    app.listen(80)
    print("go to http://localhost/samples/pyprez.html in your browser")

    try:
        tornado.ioloop.IOLoop.current().start()
    except KeyboardInterrupt:
        tornado.ioloop.IOLoop.current().stop()
