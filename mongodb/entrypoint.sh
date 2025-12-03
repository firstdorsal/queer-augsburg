#!/bin/bash
set -e

# Map Bitnami environment variables to standard MongoDB ones
export MONGO_INITDB_ROOT_USERNAME="${MONGODB_ROOT_USER:-root}"
export MONGO_INITDB_ROOT_PASSWORD="${MONGODB_ROOT_PASSWORD}"

# Default values
MONGODB_PORT="${MONGODB_PORT_NUMBER:-27017}"
MONGODB_REPLICA_SET="${MONGODB_REPLICA_SET_NAME:-replicaset}"
MONGODB_REPLICA_KEY="${MONGODB_REPLICA_SET_KEY:-defaultkey}"
MONGODB_HOSTNAME="${MONGODB_ADVERTISED_HOSTNAME:-localhost}"
MONGODB_ADV_PORT="${MONGODB_ADVERTISED_PORT_NUMBER:-$MONGODB_PORT}"

# Data directory (Bitnami compatibility - data is in /bitnami/mongodb/data/db)
DATA_DIR="/bitnami/mongodb/data/db"

# Create keyfile for replica set authentication
KEYFILE="/bitnami/mongodb/keyfile"
echo "$MONGODB_REPLICA_KEY" > "$KEYFILE"
chmod 600 "$KEYFILE"
chown mongodb:mongodb "$KEYFILE"

# Ensure directories exist and have correct ownership
mkdir -p "$DATA_DIR"
chown -R mongodb:mongodb /bitnami/mongodb

INIT_MARKER="/bitnami/mongodb/.initialized"
NEEDS_RS_INIT=false

# Initialize MongoDB if data directory is empty
if [ ! -f "$INIT_MARKER" ]; then
    echo "Initializing MongoDB..."
    NEEDS_RS_INIT=true

    # Start MongoDB temporarily without auth to initialize
    mongod --dbpath "$DATA_DIR" --port "$MONGODB_PORT" --bind_ip_all &
    MONGOD_PID=$!

    # Wait for MongoDB to be ready
    echo "Waiting for MongoDB to start..."
    until mongosh --port "$MONGODB_PORT" --eval "db.adminCommand('ping')" > /dev/null 2>&1; do
        sleep 1
    done

    # Create root user
    echo "Creating root user..."
    mongosh --port "$MONGODB_PORT" --eval "
        db = db.getSiblingDB('admin');
        db.createUser({
            user: '$MONGO_INITDB_ROOT_USERNAME',
            pwd: '$MONGO_INITDB_ROOT_PASSWORD',
            roles: ['root']
        });
    "

    # Shutdown temporary instance
    echo "Stopping temporary instance..."
    kill $MONGOD_PID 2>/dev/null || true
    wait $MONGOD_PID 2>/dev/null || true
    sleep 2

    touch "$INIT_MARKER"
fi

# Function to initialize replica set (runs in background)
init_replica_set() {
    sleep 5  # Wait for mongod to be fully ready

    echo "Checking replica set status..."
    RS_STATUS=$(mongosh --port "$MONGODB_PORT" -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --quiet --eval "try { rs.status().ok } catch(e) { 0 }" 2>/dev/null || echo "0")

    if [ "$RS_STATUS" != "1" ]; then
        echo "Initializing replica set..."
        mongosh --port "$MONGODB_PORT" -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --eval "
            rs.initiate({
                _id: '$MONGODB_REPLICA_SET',
                members: [{
                    _id: 0,
                    host: '$MONGODB_HOSTNAME:$MONGODB_ADV_PORT'
                }]
            });
        "
        echo "Replica set initialized"
    else
        echo "Replica set already initialized"
    fi
}

# Start replica set init in background
init_replica_set &

# Start MongoDB in foreground with replica set configuration
echo "Starting MongoDB with replica set '$MONGODB_REPLICA_SET' on port $MONGODB_PORT..."
exec mongod \
    --dbpath "$DATA_DIR" \
    --port "$MONGODB_PORT" \
    --bind_ip_all \
    --replSet "$MONGODB_REPLICA_SET" \
    --keyFile "$KEYFILE"
