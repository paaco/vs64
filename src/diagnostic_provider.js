//
// Diagnostic Provider
//

const vscode = require('vscode');

//-----------------------------------------------------------------------------------------------//
// Init module
//-----------------------------------------------------------------------------------------------//
// eslint-disable-next-line
BIND(module);

//-----------------------------------------------------------------------------------------------//
// Required Modules
//-----------------------------------------------------------------------------------------------//
var Constants = require('src/constants');
var Utils = require('src/utils');

//-----------------------------------------------------------------------------------------------//
// Diagnostic Provider
//-----------------------------------------------------------------------------------------------//

class DiagnosticProvider {

    constructor(extension) {
        this._extension = extension;
        this._context = extension._context;
        this._diagnostics = null;

        {
            this._collection = vscode.languages.createDiagnosticCollection(Constants.AssemblerLanguageId);
            this._context.subscriptions.push(this._collection);
        }

    }

    clear() {
        if (this._diagnostics) {
            for (var uri of this._diagnostics.keys()) {
                this._collection.set(vscode.Uri.file(uri), null);
            }
            this._diagnostics = null;
        }
    }

    update(buildProcessInfo) {
        this._diagnostics = this.createDiagnosticsInfo(buildProcessInfo);
        for (let [uri, list] of this._diagnostics) {
            this._collection.set(vscode.Uri.file(uri), list);
        }
    }

    // Serious error - File d:\Work\vs64\test\programs\src\test aaa 2.asm, line 46 (Zone <untitled>): Missing '{'.
    // Error - File d:\Work\vs64\test\programs\src\test aaa 2.asm, line 12 (Zone <untitled>): Value not defined (qloop).
    // Warning - File d:\Work\vs64\test\programs\src\test aaa 2.asm, line 16 (Zone <untitled>): Label name not in leftmost column.

    parseError(str) {

        var WHITESPACES = " \t\r\n";

        var err = {};
        err.raw = str;

        var pos = 0;

        var s = str.toLowerCase();

        while (WHITESPACES.indexOf(s.charAt(pos)) >= 0) { pos++; }

        if (s.indexOf("error - file ") == 0) {
            err.isError = true;
            pos += 13;
        } else if (s.indexOf("serious error - file ") == 0) {
            err.isError = true;
            pos += 21;
        } else if (s.indexOf("warning - file ") == 0) {
            err.isWarning = true;
            pos += 15;
        } else {
            return null; // invalid start
        }

        var pos2 = s.indexOf(',' , pos);
        if (pos2 < pos + 3) {
            return null; // no filename
        }

        err.filename = str.substr(pos, pos2-pos).trim();

        pos = pos2 + 1;
        while (WHITESPACES.indexOf(s.charAt(pos)) >= 0) { pos++; }

        pos = s.indexOf("line", pos);
        if (pos < 0) {
            return null; // no line number token
        }

        pos += 4; // skip 'line' and whitespaces after
        while (WHITESPACES.indexOf(s.charAt(pos)) >= 0) { pos++; }

        pos2 = s.indexOf(' ', pos);
        if (pos2 < 0) {
            return null; // no line number
        }

        err.line = parseInt(str.substr(pos, pos2-pos)) - 1;

        pos = s.indexOf(':', pos2);
        if (pos < 0) {
            return null; // no text separator
        }
        pos++;

        err.text = str.substr(pos).trim(); // text

        return err;
    }

    addAsDiagnostic(line, diagnostics) {
        let err = this.parseError(line);
        if (err) {
            let uri = Utils.getAbsoluteFilename(err.filename);
            let diagnostic = new vscode.Diagnostic(
                new vscode.Range(err.line, 0, err.line, 0),
                err.text,
                err.isWarning ? vscode.DiagnosticSeverity.Warning : vscode.DiagnosticSeverity.Error
            );

            if (!diagnostics.has(uri)) {
                diagnostics.set(uri, [])
            }
            diagnostics.get(uri).push(diagnostic);
        }
    }

    createDiagnosticsInfo(buildProcessInfo) {

        /*
        if (0 == buildProcessInfo.exitCode) {
            return null; // no error;
        }
        */

        let diagnostics = new Map();

        for (let i=0, line; (line=buildProcessInfo.stdout[i]); i++) {
            this.addAsDiagnostic(line, diagnostics);
        }

        for (let i=0, line; (line=buildProcessInfo.stderr[i]); i++) {
            this.addAsDiagnostic(line, diagnostics);
        }

        return diagnostics;
    }
}

//-----------------------------------------------------------------------------------------------//
// Module Exports
//-----------------------------------------------------------------------------------------------//

module.exports = DiagnosticProvider;
