#!/bin/bash
mkdir results > /dev/null 2>&1
set -e
mpm render templates/secrets.env > results/.env