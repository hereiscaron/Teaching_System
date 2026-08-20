' Homeroom Workbench - stop the local service (hidden)
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
root = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = root
shell.Run "cmd /c node wb.js stop", 0, True
