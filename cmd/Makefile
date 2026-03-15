BINARY := slim
VERSION := $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")

ifeq ($(OS),Windows_NT)
	BINARY := slim.exe
endif

# Use platform-appropriate copy/move/remove commands.
ifeq ($(OS),Windows_NT)
	CP := cmd /C copy /Y
	CP_DEST := docs\\public\\install.sh
	MV := cmd /C move
	RM := cmd /C del /Q
	HOME_DIR := $(HOME)
	ifeq ($(HOME_DIR),)
		HOME_DIR := $(USERPROFILE)
	endif
	INSTALL_DIR := $(HOME_DIR)\\bin
else
	CP := cp
	CP_DEST := docs/public/install.sh
	MV := mv
	RM := rm -f
	INSTALL_DIR := /usr/local/bin
endif

.PHONY: build install clean test

build:
	go build -ldflags "-s -w -X github.com/kamranahmedse/slim/cmd.Version=$(VERSION)" -o $(BINARY) .
	$(CP) install.sh $(CP_DEST)

install: build
ifeq ($(OS),Windows_NT)
	@cmd /C if not exist "$(INSTALL_DIR)" mkdir "$(INSTALL_DIR)"
	$(MV) $(BINARY) "$(INSTALL_DIR)\\$(BINARY)"
else
	$(MV) $(BINARY) $(INSTALL_DIR)
endif

clean:
	$(RM) $(BINARY)

test:
	go test ./...

slim start myapp --port 2000
