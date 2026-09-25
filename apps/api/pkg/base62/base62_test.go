package base62

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGenerate(t *testing.T) {
	t.Run("generates string of expected length", func(t *testing.T) {
		lengths := []int{4, 6, 8, 12, 16}
		for _, l := range lengths {
			code, err := Generate(l)
			require.NoError(t, err)
			assert.Len(t, code, l)
			for _, ch := range code {
				assert.True(t, strings.ContainsRune(charset, ch), "character %c not in charset", ch)
			}
		}
	})

	t.Run("returns error for non-positive length", func(t *testing.T) {
		_, err := Generate(0)
		assert.Error(t, err)

		_, err = Generate(-5)
		assert.Error(t, err)
	})

	t.Run("generates unique values", func(t *testing.T) {
		seen := make(map[string]bool)
		for i := 0; i < 100; i++ {
			code, err := Generate(8)
			require.NoError(t, err)
			assert.False(t, seen[code], "duplicate code generated: %s", code)
			seen[code] = true
		}
	})
}
