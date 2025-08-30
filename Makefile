# See /LICENSE for more information.
# This is free software, licensed under the GNU General Public License v2.

include $(TOPDIR)/rules.mk

LUCI_TITLE:=Access management application for luci
LUCI_DEPENDS:=+luci-base
LUCI_PKGARCH:=all

PKG_LICENSE:=MIT
PKG_MAINTAINER:=Jan van Stiphout <jan.stiphout@gmail.com>

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
