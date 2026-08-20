' Teacher Workbench Launcher (double-click to open)
' Layout: this file sits in the parent folder; app/ = code, data/ = data.
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

root = fso.GetParentFolderName(WScript.ScriptFullName)
appDir = fso.BuildPath(root, "app")
url = "http://127.0.0.1:8731/"

shell.CurrentDirectory = appDir

Function HealthOK()
  On Error Resume Next
  Set http = CreateObject("MSXML2.XMLHTTP")
  http.Open "GET", url & "api/health", False
  http.Send
  HealthOK = (Err.Number = 0 And http.Status = 200)
  On Error GoTo 0
End Function

If Not HealthOK() Then
  shell.Run "cmd /c node wb.js start", 0, True
End If

Dim ok
ok = False
Dim i
For i = 1 To 33
  WScript.Sleep 300
  If HealthOK() Then
    ok = True
    Exit For
  End If
Next

If ok Then
  shell.Run url, 1, False
Else
  MsgBox "Workbench failed to start. Check app\data permissions or port 8731.", 48, "Teacher Workbench"
End If