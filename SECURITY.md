Security
========

### Why is this site hosted as HTTP / why is my browser saying it's insecure?

To give you a `[scan-my-local-network-for-my-printer]` button!

Your 3D printer is already listening on an unsecure HTTP/Websocket port (usually `ws://[...]:81`). Modern
browsers (usually [for good reason](https://www.cloudflare.com/learning/ssl/what-is-mixed-content/))
disallow `https://` sites from talking to `http://`
sites.  The `ws://` protocol is an extension of `http://`. Ergo, no `https://` website will ever be able
to talk to a `ws://` printer.

Nothing this app does makes your network or printer any less secure than it already is.  If
you're still concerned, your only recourse is to turn off your printer's WiFi and/or modify
the firmware.
