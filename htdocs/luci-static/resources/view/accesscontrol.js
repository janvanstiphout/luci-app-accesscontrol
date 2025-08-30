"use strict";
"require uci";
"require view";
"require network";
"require form";

return view.extend({
  handleReset: null,
  load: function () {
    return Promise.all([uci.load("accesscontrol"), network.getWifiNetworks()]);
  },
  render: function (data) {
    const networks = data[1];
    const accesscontrol = uci.sections("accesscontrol");

    const maclist = [];
    for (let i = 0; i < networks.length; i++) {
      const macfilter = uci.get("wireless", networks[i].sid, "macfilter");

      if (macfilter === "deny") {
        networks[i].maclist = L.toArray(
          uci.get("wireless", networks[i].sid, "maclist")
        );
        for (let j = 0; j < networks[i].maclist.length; j++) {
          const denied_mac = networks[i].maclist[j].toUpperCase();
          if (
            maclist.some((mac) => {
              return mac === denied_mac;
            })
          )
            continue;
          if (
            accesscontrol.some((known_client) => {
              return known_client.mac.toUpperCase() === denied_mac;
            })
          )
            maclist.push(denied_mac);
        }
      }
    }

    var body = E([E("h2", _("Control access to WiFi"))]);

    var table = E("table", { class: "table" }, [
      E("tr", { class: "tr" }, [
        E("th", { class: "th" }, [_("Name")]),
        E("th", { class: "th" }, [_("MAC")]),
        E("th", { class: "th" }, [""]),
        E("th", { class: "th" }, [""]),
      ]),
    ]);

    accesscontrol.forEach((known_client) => {
      let enable_disable;

      if (
        maclist.some((mac) => {
          return mac === known_client.mac;
        })
      ) {
        enable_disable = E(
          "div",
          {
            class: "btn cbi-button-action",
            client_mac: known_client.mac,
            click: handleEnable,
          },
          _("Enable")
        );
      } else {
        enable_disable = E(
          "div",
          {
            class: "btn cbi-button-action",
            client_mac: known_client.mac,
            click: handleDisable,
          },
          _("Disable")
        );
      }

      table.appendChild(
        E("tr", { class: "re" }, [
          E("td", { class: "td" }, [known_client.name]),
          E("td", { class: "td" }, [known_client.mac]),
          E("td", { class: "td" }, [
            E(
              "div",
              {
                class: "btn cbi-button-action",
                client_node_name: known_client[".name"],
                click: handleDelete,
              },
              "X"
            ),
          ]),
          E("td", { class: "td" }, [enable_disable]),
        ])
      );
    });

    table.appendChild(
      E("tr", { class: "re" }, [
        E("td", { class: "td" }, [
          E("input", {
            name: "new_name",
          }),
        ]),
        E("td", { class: "td" }, [
          E("input", {
            name: "new_mac",
          }),
        ]),
        E("td", { class: "td" }, [
          E(
            "button",
            {
              class: "btn cbi-button-action",
              click: handleAdd,
            },
            _("Add")
          ),
        ]),
        E("td", { class: "td" }, [""]),
      ])
    );

    body.appendChild(table);
    return body;
  },
});

function handleSave() {
  uci.save("accesscontrol").then(() => {
    location.reload();
  });
}

function handleDelete(ev) {
  const name = ev.target.getAttribute("client_node_name");
  if (confirm(_("Are you sure you want to remove this client?"))) {
    uci.remove("accesscontrol", name);
    handleSave();
  }
}

function add_known_client(new_name, new_mac) {
  const new_elem_node = uci.add("accesscontrol", "known_clients");

  uci.set("accesscontrol", new_elem_node, "name", new_name);
  uci.set("accesscontrol", new_elem_node, "mac", new_mac);

  handleSave();
}

function handleAdd(ev) {
  const mac_regex = /^([0-9A-F]{2}[:]){5}([0-9A-F]{2})$/;

  const new_name = document.querySelector('input[name="new_name"]').value;
  const new_mac_input = document.querySelector('input[name="new_mac"]').value;
  const new_mac = new_mac_input.replace("-", ":").toUpperCase();

  if (!new_name) {
    alert(_("No name given"));
    return;
  }

  if (!new_mac) {
    alert(_("No MAC address given"));
    return;
  }

  if (!mac_regex.test(new_mac)) {
    alert(_("Invalid MAC address"));
    return;
  }

  const accesscontrol = uci.sections("accesscontrol");

  if (
    accesscontrol.some((section) => {
      return section.mac === new_mac;
    })
  ) {
    alert(_("Client already exists"));
    return;
  }

  add_known_client(new_name, new_mac);
}

function handleEnable(ev) {
  const client_mac = ev.target.getAttribute("client_mac").toUpperCase();

  network.getWifiNetworks().then((networks) => {
    let save_promises = [];

    for (let i = 0; i < networks.length; i++) {
      const network_sid = networks[i].sid;
      const macfilter = uci.get("wireless", network_sid, "macfilter");

      if (macfilter === "deny") {
        const maclist = L.toArray(uci.get("wireless", network_sid, "maclist"));

        if (maclist.length > 0) {
          let other_macs = [];

          for (let j = 0; j < maclist.length; j++) {
            const mac = maclist[j].toUpperCase();
            if (mac !== client_mac) other_macs.push(mac);
          }

          if (other_macs.length > 0) {
            uci.set("wireless", network_sid, "maclist", other_macs);
          } else {
            uci.unset("wireless", network_sid, "maclist"); // Gives an error, but does still work
          }

          save_promises.push(
            uci.save("wireless").catch((save_error) => {
              console.log(_("error"));
              console.log(save_error);
            })
          );
        }
      }
    }

    if (save_promises.length > 0) {
      Promise.all(save_promises).then((done) => {
        console.log(_("done"));
        location.reload();
      });
    }
  });
}

function handleDisable(ev) {
  const client_mac = ev.target.getAttribute("client_mac").toUpperCase();

  network.getWifiNetworks().then((networks) => {
    let save_promises = [];

    for (let i = 0; i < networks.length; i++) {
      const network_sid = networks[i].sid;
      const macfilter = uci.get("wireless", network_sid, "macfilter");

      if (macfilter !== "deny") {
        if (macfilter === "allow") {
          alert("MAC filter is set to allow list, cannot update");
          return;
        }
        if (!macfilter) {
          uci.add("wireless", network_sid, "macfilter");
        }
        uci.set("wireless", network_sid, "macfilter", "deny");
      }

      const maclist = L.toArray(uci.get("wireless", network_sid, "maclist"));
      let all_macs = [];

      if (maclist.length > 0) {
        for (let j = 0; j < maclist.length; j++) {
          const mac = maclist[j].toUpperCase();
          if (mac !== client_mac) all_macs.push(mac);
        }
      }

      all_macs.push(client_mac);
      uci.set("wireless", network_sid, "maclist", all_macs);

      save_promises.push(
        uci.save("wireless").catch((save_error) => {
          console.log(_("error"));
          console.log(save_error);
        })
      );
    }

    if (save_promises.length > 0) {
      Promise.all(save_promises).then((done) => {
        console.log(_("done"));
        location.reload();
      });
    }
  });
}
