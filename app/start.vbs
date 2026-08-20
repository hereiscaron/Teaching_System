' Homeroom Workbench launcher (hidden, no console window)
' Double-click: starts the local service in background and opens the browser.
' Uses `wb start` which spawns a fully detached node process (survives this script exit).
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
root = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = root
url = "http://127.0.0.1:8731/"

Function HealthOK()
  On Error Resume Next
  Set http = CreateObject("MSXML2.XMLHTTP")
  http.Open "GET", url & "api/health", False
  http.Send
  HealthOK = (Err.Number = 0 And http.Status = 200)
  On Error GoTo 0
End Function

If Not HealthOK() Then
  ' window style 0 = fully hidden; wb start returns immediately
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
  MsgBox "Workbench failed to start. Please check data\server-console.log", 48, "Workbench"
End If
