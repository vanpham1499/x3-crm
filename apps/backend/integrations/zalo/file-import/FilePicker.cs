using System;
using System.IO;
using System.Text;
using System.Collections.Generic;
using System.Web.Script.Serialization;
using System.Windows.Forms;

// A Windows GUI executable: the user sees only the file chooser, never a console.
public static class ZaloTeamFilePicker {
    [STAThread]
    public static void Main(string[] args) {
        Guid requestId;
        if (args.Length != 2 || !Guid.TryParse(args[1], out requestId) || !Path.IsPathRooted(args[0])) return;
        var result = new Dictionary<string, object> { { "id", args[1] }, { "state", "cancelled" } };
        Application.EnableVisualStyles();
        using (var owner = new Form())
        using (var dialog = new OpenFileDialog())
        using (var timer = new Timer()) {
            owner.ShowInTaskbar = false;
            owner.TopMost = true;
            owner.Opacity = 0;
            owner.StartPosition = FormStartPosition.CenterScreen;
            dialog.Title = "Zalo Team - Chọn file xuất Zalo";
            dialog.Filter = "File xuất Zalo (*.zl.zip)|*.zl.zip";
            dialog.CheckFileExists = true;
            dialog.Multiselect = false;
            dialog.RestoreDirectory = true;
            timer.Interval = 180000;
            timer.Tick += delegate { timer.Stop(); Application.Exit(); };
            owner.Shown += delegate {
                timer.Start();
                try {
                    if (dialog.ShowDialog(owner) == DialogResult.OK) {
                        result["state"] = "selected";
                        result["path"] = dialog.FileName;
                    }
                } catch { result["state"] = "error"; }
                finally { owner.Close(); }
            };
            Application.Run(owner);
        }
        var temp = args[0] + "." + args[1] + ".tmp";
        File.WriteAllText(temp, new JavaScriptSerializer().Serialize(result), new UTF8Encoding(false));
        if (File.Exists(args[0])) File.Replace(temp, args[0], null);
        else File.Move(temp, args[0]);
    }
}
