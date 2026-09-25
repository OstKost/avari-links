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

	// ErrPremiumSlugRequired is returned when a non-premium user requests a short custom slug (4-7 characters).
	ErrPremiumSlugRequired = errors.New("short custom slugs (4-7 characters) require Premium status")

	// ErrLinkInactive is returned when an attempt is made to redirect through a deactivated link.
	ErrLinkInactive       = errors.New("link is deactivated")
	ErrNSFWLabelRequired  = errors.New("nsfw label required")
	ErrBlockedDestination = errors.New("destination is blocked")

	// ErrInvalidSessionKey is returned when the provided mnemonic key is invalid or not found.
	ErrInvalidSessionKey = errors.New("invalid access key")

	// ErrUnauthorized is returned when an operation requires an active session key.
	ErrUnauthorized = errors.New("unauthorized")

	// ErrForbidden is returned when a user attempts to access/modify a link they do not own.
	ErrForbidden = errors.New("forbidden")
)
