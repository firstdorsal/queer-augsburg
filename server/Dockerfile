# 0. BUILD STAGE
FROM clux/muslrust:stable AS build
# build deps
USER root
RUN apt-get update && apt-get install upx -y

COPY Cargo.toml Cargo.lock ./
COPY .cargo .cargo
# Stub lib and bin, so that this layer compiles only the locked dependencies and stays cached
# until they change. New targets in Cargo.toml need a stub here too.
RUN mkdir src && echo 'fn main() {}' > src/main.rs && touch src/lib.rs \
    && cargo build --release --locked --bin main \
    && rm -rf src
# build
COPY --chown=root:root src src
# Cargo compares modification times, and the copied sources can be older than the stubs,
# which would leave the stub binary in place.
RUN find src -name '*.rs' -exec touch {} + \
    && cargo build --release --locked --bin main
RUN strip target/x86_64-unknown-linux-musl/release/main
RUN upx --best --lzma target/x86_64-unknown-linux-musl/release/main
RUN useradd -u 50001 -N qa-server
RUN groupadd -g 50001 qa-server

# create readonly dirs


# 1. APP STAGE
FROM scratch
WORKDIR /app
COPY --from=build /volume/target/x86_64-unknown-linux-musl/release/main ./qa-server
COPY --from=build /etc/passwd /etc/passwd
COPY --from=build /etc/group /etc/group


USER qa-server
# The server saves open documents on SIGTERM; compose gives it `stop_grace_period`.
STOPSIGNAL SIGTERM
EXPOSE 80
# run it 
ENTRYPOINT ["./qa-server"]
