#!/bin/zsh
# Creates this Mac's signing certificate for T3 Code Custom, once.
#
# macOS ties permissions and keychain access to an app's signature. An ad-hoc
# signature changes with every build, so each build asks for them again. A
# fixed certificate makes every build the same app to macOS.
#
# The certificate is self-signed and stays on this Mac, in its own keychain
# under ~/.t3code-custom. Nothing is added to the login keychain.
set -eu

STATE="${T3CODE_CUSTOM_STATE:-$HOME/.t3code-custom}"
KEYCHAIN="$STATE/signing.keychain-db"
IDENTITY="T3 Code Custom Signing"

if [[ -e "$KEYCHAIN" ]]; then
  echo "Signing certificate already set up in $STATE."
  exit 0
fi

mkdir -p "$STATE"
chmod 700 "$STATE"
umask 077
work=$(mktemp -d "$STATE/.setup.XXXXXX")
trap 'rm -rf "$work"' EXIT

password=$(/usr/bin/openssl rand -hex 24)
printf '%s' "$password" >"$STATE/signing-keychain-password"
cat >"$work/cert.cnf" <<EOF
[req]
distinguished_name = dn
x509_extensions = ext
prompt = no
[dn]
CN = $IDENTITY
[ext]
basicConstraints = critical,CA:false
keyUsage = critical,digitalSignature
extendedKeyUsage = critical,codeSigning
EOF
# The system LibreSSL writes a PKCS#12 file that `security import` can read.
/usr/bin/openssl req -x509 -newkey rsa:2048 -nodes -days 7300 -config "$work/cert.cnf" \
  -keyout "$work/key.pem" -out "$work/cert.pem" 2>/dev/null
transport=$(/usr/bin/openssl rand -hex 12)
/usr/bin/openssl pkcs12 -export -inkey "$work/key.pem" -in "$work/cert.pem" -name "$IDENTITY" \
  -out "$work/identity.p12" -passout "pass:$transport"

security create-keychain -p "$password" "$KEYCHAIN"
security set-keychain-settings "$KEYCHAIN"
security unlock-keychain -p "$password" "$KEYCHAIN"
security import "$work/identity.p12" -k "$KEYCHAIN" -P "$transport" -T /usr/bin/codesign >/dev/null
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$password" "$KEYCHAIN" >/dev/null
security lock-keychain "$KEYCHAIN"
cp "$work/cert.pem" "$STATE/signing-cert.pem"
echo "Created the \"$IDENTITY\" certificate in $STATE."
