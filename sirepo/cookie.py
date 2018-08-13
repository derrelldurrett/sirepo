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

from pykern.pkdebug import pkdc, pkdexc, pkdlog, pkdp

# Dict key for referencing cookie UIDs
_COOKIE_USER_KEY = 'uid'

# Session key in Flask on the request:
_HTTP_COOKIE_KEY = 'HTTP_COOKIE'

class Cookie:
    """Container for the current session's cookies. Primarily concerned with making
    sure a uid lives on the cookie, and whether or not the related user
    """
    def __init__(self):
        self._cookies = self._as_dict(flask.request.environ.get(_HTTP_COOKIE_KEY))
        # I'm pretty sure this will break some way or another I haven't thought about.
        self.user = self._cookies.get(_COOKIE_USER_KEY)


    def init_user(self, *args):
        if args:
            _uid = args[0]
            self.user = _uid
            self._cookies[_COOKIE_USER_KEY] = _uid
        return self.user


    def _as_dict(self, formatted_str):
        """Helper function to turn a cookie-formatted string ('name1=value1;name2=value2')
        into a dict. The names become keys in the dict."""
        cookie_as_dict = {}
        for _bit in formatted_str.split(';'):
            _bits = _bit.split('=')
            cookie_as_dict[_bits[0]] = _bits[1]
        return cookie_as_dict
