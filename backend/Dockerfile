FROM golang:1.25-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY *.go ./
COPY migrations/ migrations/
RUN CGO_ENABLED=0 go build -o /backend .

FROM alpine:3.21
WORKDIR /app
RUN apk add --no-cache ca-certificates
COPY --from=builder /backend .
EXPOSE 8082
CMD ["./backend"]
