#!/usr/bin/bash

for x in `seq $1 $2`; do
  hugo new post/$x.md
done
