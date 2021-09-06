#!/bin/bash
ICON=$HOME/.config/lock-screen.png
TMPBG=/tmp/screen.png
rm -f $TMPBG
scrot -z $TMPBG
convert $TMPBG -scale 20% -scale 500% +level 0,70% $TMPBG
convert $TMPBG $ICON -gravity center -composite -matte $TMPBG
i3lock -u -i $TMPBG
