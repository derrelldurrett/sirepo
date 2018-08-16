# -*- coding: utf-8 -*-
u"""Handle cookies.

Replaces the Beaker session/cookie management code currently being used, and creates
more straightforward cookies, and manages cookies differently, since we don't want to
create server sessions for every user that shows up (since so many of them are not
going to return to be "full users", and disk space isn't *that* cheap).

The basic idea:
    1) A new user (who holds no cookie) shows up.
    2) We set a cookie with a unique ID, but use (if it already exists) the "default"
       simulation directory. Create the default simulation directory if it doesn't
       exist (or maybe at server start?)
       --- This probably means we need to make sure to check for all uses of
           _user_dir() in simulation_db.py....
       --- I'm sure there's more I'm missing.
    3) If we get a returning user who ???? (not sure what decision tree goes here
       exactly), we create them their own directory, which we use from then on out.

:copyright: Copyright (c) 2018 RadiaSoft LLC.  All Rights Reserved.
:license: http://www.apache.org/licenses/LICENSE-2.0.html
"""
from __future__ import absolute_import, division, print_function
import base64
import flask
import inspect
import json
import re
from pykern import pkconfig
from pykern import pkcollections

from pykern.pkdebug import pkdc, pkdexc, pkdlog, pkdp


# Session key in Flask on the request:
_HTTP_COOKIE_KEY = 'HTTP_COOKIE'

# A really long time (almost 10 years)
_COOKIE_EXPIRY_TIME = 10 * 365 * 24 * 3600

# A default cookie value for the 'hello' key
_ROBS_HELLO_COOKIE = 'I am not yet known to be a real user'

def get_user():
    """Get the user from the Flask session.

    Returns:
        str: the user's id
    """
    _init_state()
    return flask.g.sirepo_cookie.uid


def clear_user():
    """Clear the user's id.
    """
    set_user(None)


def is_valid():
    """Check if there's a valid cookie.

    Returns:
        bool: True if there's a cookie containing a 'hello' key
    """
    d = _hydrate_dict()
    return d or 'hello' in d


def set_user(uid):
    """Sets the user on the cookie.
    """
    flask.g.sirepo_cookie.set_user(uid=uid)


def set_cookie(resp):
    """Initializes, if necessary, and sets the cookie on the response."""
    _init_state()
    flask.g.sirepo_cookie.set_response(resp)
    return resp


def _hydrate_dict():
    i = flask.request.environ.get(_HTTP_COOKIE_KEY)
    d = None
    if i:
        # This seeks to
        m = re.search('{}=([^;]+);?'.format(cfg.key), i)
        d = json.loads(base64.urlsafe_b64decode(m.group(1))) if m else {}
    return d


def _init_state():
    if not 'sirepo_cookie' in flask.g:
        flask.g.sirepo_cookie = _State()


class _State(pkcollections.Dict):
    """Container for the current session's cookies. """
    def __init__(self):
        self._changed = False
        self.hello = _ROBS_HELLO_COOKIE
        c = _hydrate_dict()
        if c:
            self.hello = c.get('hello')
            self.uid = c.get('uid') or None


    def set_response(self, resp):
        resp.set_cookie(cfg.key, self._serialize() or '', max_age=_COOKIE_EXPIRY_TIME)


    def set_user(self, **kwargs):
        self.update(_changed=True, hello='hello', **kwargs)


    def _serialize(self):
        i = {}
        for k,v in self.items():
            if not k.startswith('_'):
                i[k] = v
        return base64.urlsafe_b64encode(json.dumps(i))


@pkconfig.parse_none
def _cfg_secret(value):
    """Reads file specified as config value"""
    if not value:
        return 'dev dummy secret'
    with open(value) as f:
        return f.read()


cfg = pkconfig.init(
    key=('sr_' + pkconfig.cfg.channel, str, 'Name of the cookie key used to save the session under'),
    secret=(None, _cfg_secret, 'Used to encrypt cookie'),
    secure=(not pkconfig.channel_in('dev'), bool, 'Whether or not the session cookie should be marked as secure'),
)
