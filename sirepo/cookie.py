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
import flask
from pykern import pkconfig
from pykern import pkcollections

from pykern.pkdebug import pkdc, pkdexc, pkdlog, pkdp


# Session key in Flask on the request:
_HTTP_COOKIE_KEY = 'HTTP_COOKIE'

# A really long time
_COOKIE_EXPIRY_TIME = 10 * 365 * 24 * 3600

def get_user():
    """Get the user from the Flask session
    """
    if not 'sirepo_cookie' in flask.g:
        flask.g.sirepo_cookie = _State()
    return flask.g.sirepo_cookie.uid


def clear_user():
    set_user(None)


def set_user(uid):
    flask.g.sirepo_cookie._set(uid=uid)


def set_cookie(resp):
    if 'sirepo_cookie' in flask.g:
       flask.g.sirepo_cookie.set_response(resp)
    return resp


class _State(pkcollections.Dict):
    """Container for the current session's cookies. Primarily concerned with making
    sure a uid lives on the cookie, and whether or not the related user
    """
    def __init__(self):
        cookies = self._as_dict(flask.request.environ.get(_HTTP_COOKIE_KEY))
        self._changed = False
        self.uid = cookies.get(cfg.key) or None


    def set_response(self, resp):
        if self._changed:
            resp.set_cookie(cfg.key, self.uid or '', max_age=_COOKIE_EXPIRY_TIME)


    def _set(self, **kwargs):
        self.update(_changed=True, **kwargs)


    def _as_dict(self, formatted_str):
        """Helper function to turn a cookie-formatted string ('name1=value1;name2=value2')
        into a dict. The names become keys in the dict."""
        cookie_as_dict = {}
        for b in formatted_str.split(';'):
            bs = b.split('=')
            cookie_as_dict[bs[0].strip()] = bs[1]
        return cookie_as_dict


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
