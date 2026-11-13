%global debug_package %{nil}
%global __strip /bin/true
%global __os_install_post %{nil}
%{!?nod_payload:%global nod_payload w19.zstdio}
%global _binary_payload %{nod_payload}
%global _build_id_links none

Name:           nod
Version:        %{nod_version}
Release:        1%{?dist}
Summary:        The open source personal agent from n8n
License:        Apache-2.0 AND LicenseRef-Electron-Chromium
URL:            https://nod.n8n.io
AutoReqProv:    no
ExclusiveArch:  x86_64

Requires:       qemu-system-x86-core
Requires:       qemu-img
Requires:       openssh-clients
Requires:       libsecret
Requires:       gtk3
Requires:       nss
Requires:       alsa-lib
Requires:       libdrm
Requires:       mesa-libgbm
Requires:       libxkbcommon
Requires:       at-spi2-core
Requires:       libXScrnSaver
Requires:       libnotify
Requires:       xdg-utils
Recommends:     gnome-keyring
Recommends:     firefox

%description
Nod is a personal agent that works across your connected apps, a private
workspace and its own browser. It runs on your computer inside its own
virtual machine and asks before it acts on your behalf when your words
don't cover an action.

%prep

%build

%install
install -d %{buildroot}/usr/lib
cp -a %{nod_application} %{buildroot}/usr/lib/nod
install -Dm755 %{nod_rpm}/nod.sh %{buildroot}/usr/bin/nod
install -Dm644 %{nod_flatpak}/io.n8n.Nod.desktop %{buildroot}/usr/share/applications/io.n8n.Nod.desktop
install -Dm644 %{nod_flatpak}/io.n8n.Nod.metainfo.xml %{buildroot}/usr/share/metainfo/io.n8n.Nod.metainfo.xml
install -Dm644 %{nod_assets}/nod-macos.svg %{buildroot}/usr/share/icons/hicolor/scalable/apps/io.n8n.Nod.svg
chmod -R go-w %{buildroot}/usr/lib/nod
chmod 755 %{buildroot}/usr/lib/nod

%files
/usr/bin/nod
/usr/lib/nod
%attr(4755,root,root) /usr/lib/nod/chrome-sandbox
/usr/share/applications/io.n8n.Nod.desktop
/usr/share/metainfo/io.n8n.Nod.metainfo.xml
/usr/share/icons/hicolor/scalable/apps/io.n8n.Nod.svg
