; The installer people double-click: Superint Video into the user's own programs folder, with an
; entry in the Start menu, an icon on the desktop and an entry under Settings > Apps to remove it.
; It needs no administrator rights. scripts/build.ps1 builds it with Inno Setup 6:
;
;   ISCC.exe /DAppVersion=0.9.2 /DSourceDir=<dist> /DOutputDir=<dist> packaging\setup.iss
;
; The program folder goes onto the user's search path, so a coding agent finds `superint-video`
; in every new terminal. Films and settings live elsewhere and stay when the app is removed.

#ifndef AppVersion
  #error Pass the version: ISCC /DAppVersion=x.y.z
#endif
#ifndef SourceDir
  #define SourceDir "..\dist"
#endif
#ifndef OutputDir
  #define OutputDir "..\dist"
#endif

[Setup]
; Never change the id: it is how an update finds the installed app.
AppId={{C6BA29A5-167F-4761-AE00-467AE9CB2C70}
AppName=Superint Video
AppVersion={#AppVersion}
AppVerName=Superint Video {#AppVersion}
AppPublisher=marlonka
AppPublisherURL=https://github.com/marlonka/superint-video
AppSupportURL=https://github.com/marlonka/superint-video/issues
AppUpdatesURL=https://github.com/marlonka/superint-video/releases
VersionInfoVersion={#AppVersion}
DefaultDirName={autopf}\Superint Video
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
; Two pages: what to add, then done. No folder or Start menu group to choose.
DisableDirPage=yes
DisableProgramGroupPage=yes
DisableReadyPage=yes
WizardStyle=modern dynamic
ShowLanguageDialog=no
LanguageDetectionMethod=uilanguage
SetupIconFile=app.ico
UninstallDisplayIcon={app}\Superint Video.exe
UninstallDisplayName=Superint Video
; A running app or Studio holds the program; it is stopped before files are replaced.
CloseApplications=yes
RestartApplications=no
ChangesEnvironment=yes
OutputDir={#OutputDir}
OutputBaseFilename=Superint-Video-Setup
Compression=lzma2/max
SolidCompression=yes

[Languages]
; English first: it is the language for every system that speaks neither.
Name: "en"; MessagesFile: "compiler:Default.isl"
Name: "de"; MessagesFile: "compiler:Languages\German.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[InstallDelete]
; What came with an earlier version and is gone from this one must not stay behind.
Type: filesandordirs; Name: "{app}\skills"
Type: filesandordirs; Name: "{app}\docs"
Type: filesandordirs; Name: "{app}\prompts"

[Files]
Source: "{#SourceDir}\Superint Video.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#SourceDir}\superint-video.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#SourceDir}\README.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#SourceDir}\README.en.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#SourceDir}\CHANGELOG.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#SourceDir}\LICENSE"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#SourceDir}\THIRD_PARTY_NOTICES.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#SourceDir}\SECURITY.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#SourceDir}\docs\*"; DestDir: "{app}\docs"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#SourceDir}\skills\*"; DestDir: "{app}\skills"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#SourceDir}\prompts\*"; DestDir: "{app}\prompts"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\Superint Video"; Filename: "{app}\Superint Video.exe"; WorkingDir: "{app}"
Name: "{autodesktop}\Superint Video"; Filename: "{app}\Superint Video.exe"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{app}\Superint Video.exe"; Description: "{cm:LaunchProgram,Superint Video}"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "{app}\superint-video.exe"; Parameters: "app --stop"; Flags: runhidden waituntilterminated; RunOnceId: "StopApp"

[Code]
const
  EnvironmentKey = 'Environment';

{ The app and the Studios of its films run from the installed program; an update stops them
  first, and the app brings the Studios back when it starts again. }
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  Tool: String;
  Code: Integer;
begin
  Result := '';
  Tool := ExpandConstant('{app}\superint-video.exe');
  if FileExists(Tool) then
    Exec(Tool, 'app --stop', '', SW_HIDE, ewWaitUntilTerminated, Code);
end;

{ Whether Folder is one of the entries of the user's search path, in any case and with or
  without a closing backslash. }
function PathHas(Paths, Folder: String): Boolean;
var
  Rest, Part: String;
  At: Integer;
begin
  Result := False;
  Rest := Paths + ';';
  while (Rest <> '') and not Result do
  begin
    At := Pos(';', Rest);
    Part := Trim(Copy(Rest, 1, At - 1));
    Rest := Copy(Rest, At + 1, Length(Rest));
    Result := (Part <> '') and
      (CompareText(RemoveBackslashUnlessRoot(Part), RemoveBackslashUnlessRoot(Folder)) = 0);
  end;
end;

{ The value is read and written as stored, so that entries such as %USERPROFILE%\bin keep
  their variables. Folder goes in so that taking it out again gives back the value exactly as
  it was, a closing semicolon included. }
procedure AddToPath(Folder: String);
var
  Paths: String;
begin
  if not RegQueryStringValue(HKCU, EnvironmentKey, 'Path', Paths) then
    Paths := '';
  if PathHas(Paths, Folder) then
    Exit;
  if Paths = '' then
    Paths := Folder
  else if Paths[Length(Paths)] = ';' then
    Paths := Paths + Folder + ';'
  else
    Paths := Paths + ';' + Folder;
  RegWriteExpandStringValue(HKCU, EnvironmentKey, 'Path', Paths);
end;

{ Takes out the entry the installer put in, with the semicolon before it. }
procedure RemoveFromPath(Folder: String);
var
  Paths, Wrapped: String;
  At: Integer;
begin
  if not RegQueryStringValue(HKCU, EnvironmentKey, 'Path', Paths) then
    Exit;
  Wrapped := ';' + Paths + ';';
  At := Pos(';' + Uppercase(Folder) + ';', Uppercase(Wrapped));
  if At = 0 then
    Exit;
  Delete(Wrapped, At, Length(Folder) + 1);
  RegWriteExpandStringValue(HKCU, EnvironmentKey, 'Path', Copy(Wrapped, 2, Length(Wrapped) - 2));
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
    AddToPath(ExpandConstant('{app}'));
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usPostUninstall then
    RemoveFromPath(ExpandConstant('{app}'));
end;
