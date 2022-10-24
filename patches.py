import builtins
oldimport = builtins.__import__

patches_complete = []


def patch_save_fig():
    from matplotlib.figure import Figure
    from js import document

    if "savefig" not in patches_complete:
        original_savefig = Figure.savefig
        def savefig(fig, id, *a, **kw):
            import os
            import base64

            el = document.getElementById(id)
            if el is None:
                el = document.createElement("div")
                document.body.append(el)

            original_savefig(fig, "temp.png", *a, **kw)
            with open("temp.png", "rb") as image_file:
                encoded_string = base64.b64encode(image_file.read()).decode()
            os.remove("temp.png")
            src = "data:image/png;charset=utf-8;base64," + encoded_string
            if id:
                el = document.getElementById(id)
                if el is None:
                    el = document.createElement("img")
                    el.id = id
                    document.body.append(el)
                el.src = src
            return src
        Figure.savefig = savefig
        patches_complete.append("savefig")


def patch_plot():
    if "plot" not in patches_complete:
        import matplotlib
        patch_save_fig()

        original_plot = matplotlib.pyplot.plot
        def plot(*a, id="mpl", **kw):
            r = original_plot(*a, **kw)
            fig = matplotlib.pyplot.gcf()
            fig.savefig(id)
            return r
        matplotlib.pyplot.plot = plot
        patches_complete.append("plot")

patches = {
    "matplotlib.pyplot": patch_plot

}

def newimport(*a, **kw):
    r = oldimport(*a, **kw)
    if len(a) and a[0] in patches:
        patches[a[0]]()
    return r
builtins.__import__ = newimport
