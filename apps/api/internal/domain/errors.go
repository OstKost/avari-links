package domain

import "errors"

var (
	// ErrNotFound is returned when a requested resource does not exist.
	ErrNotFound = errors.New("resource not found")

	// ErrConflict is returned when a unique constraint is violated (e.g. custom slug already taken).
	ErrConflict = errors.New("resource already exists")

	// ErrInvalidURL is returned when the provided URL is malformed or not an allowed scheme.
	ErrInvalidURL = errors.New("invalid target url")

	// ErrInvalidSlug is returned when a custom slug contains forbidden characters or invalid length.
	ErrInvalidSlug = errors.New("invalid custom slug")

	// ErrLinkInactive is returned when an attempt is made to redirect through a deactivated link.
	ErrLinkInactive       = errors.New("link is deactivated")
	ErrNSFWLabelRequired  = errors.New("nsfw label required")
	ErrBlockedDestination = errors.New("destination is blocked")
)
