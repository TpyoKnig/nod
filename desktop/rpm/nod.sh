#!/bin/sh
export NOD_PACKAGE=rpm
case "${XDG_CURRENT_DESKTOP:-}" in
  *KDE*) exec /usr/lib/nod/nod "$@" ;;
  *) exec /usr/lib/nod/nod --password-store=gnome-libsecret "$@" ;;
esac
