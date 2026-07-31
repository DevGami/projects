#!/bin/bash
# FortisExam â€” Generate RSA-2048 Key Pairs
# Generates keys for cloud signing and edge node decryption.

set -e

KEYS_DIR="./keys"
mkdir -p "$KEYS_DIR"

echo "ðŸ”‘ Generating RSA-2048 key pairs..."

# Cloud key pair (for QR signing, package signing)
if [ ! -f "$KEYS_DIR/cloud_private.pem" ]; then
    openssl genrsa -out "$KEYS_DIR/cloud_private.pem" 2048
    openssl rsa -in "$KEYS_DIR/cloud_private.pem" -pubout -out "$KEYS_DIR/cloud_public.pem"
    echo "âœ… Cloud key pair generated"
else
    echo "âš ï¸ Cloud key pair already exists, skipping"
fi

# Edge key pair (for JWT signing, key unwrapping)
if [ ! -f "$KEYS_DIR/edge_private.pem" ]; then
    openssl genrsa -out "$KEYS_DIR/edge_private.pem" 2048
    openssl rsa -in "$KEYS_DIR/edge_private.pem" -pubout -out "$KEYS_DIR/edge_public.pem"
    echo "âœ… Edge key pair generated"
else
    echo "âš ï¸ Edge key pair already exists, skipping"
fi

echo "ðŸ”‘ Keys stored in: $KEYS_DIR/"
ls -la "$KEYS_DIR/"
