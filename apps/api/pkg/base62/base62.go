package base62

import (
	"crypto/rand"
	"errors"
	"math/big"
)

const charset = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"

var charsetLength = big.NewInt(int64(len(charset)))

// Generate generates a cryptographically secure random string of specified length using Base62 alphabet.
func Generate(length int) (string, error) {
	if length <= 0 {
		return "", errors.New("length must be greater than zero")
	}

	bytes := make([]byte, length)
	for i := 0; i < length; i++ {
		num, err := rand.Int(rand.Reader, charsetLength)
		if err != nil {
			return "", err
		}
		bytes[i] = charset[num.Int64()]
	}

	return string(bytes), nil
}
