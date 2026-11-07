package in.glucoflow.demo;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Pattern;

@CapacitorPlugin(name = "CareSnapshot")
public class CareSnapshotPlugin extends Plugin {
    private static final int MAX_BYTES = 2 * 1024 * 1024;
    private static final Pattern FILE_NAME = Pattern.compile("glucoflow-synthetic-[0-9a-f-]{36}-snapshot\\.json");
    private final AtomicBoolean saving = new AtomicBoolean(false);

    @PluginMethod
    public void save(PluginCall call) {
        String filename = call.getString("filename");
        String json = call.getString("json");
        if (filename == null || !FILE_NAME.matcher(filename).matches() || json == null
            || json.length() > MAX_BYTES || json.getBytes(StandardCharsets.UTF_8).length > MAX_BYTES) {
            call.reject("This synthetic snapshot could not be saved.");
            return;
        }
        if (!saving.compareAndSet(false, true)) {
            call.reject("A snapshot save is already in progress.");
            return;
        }

        Intent picker = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        picker.addCategory(Intent.CATEGORY_OPENABLE);
        picker.setType("application/json");
        picker.putExtra(Intent.EXTRA_TITLE, filename);
        bridge.executeOnMainThread(() -> {
            try {
                startActivityForResult(call, picker, "saveResult");
            } catch (ActivityNotFoundException | IllegalStateException exception) {
                saving.set(false);
                call.reject("The Android file picker could not open.");
            }
        });
    }

    @ActivityCallback
    private void saveResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            saving.set(false);
            return;
        }
        Intent resultData = result.getData();
        Uri destination = resultData == null ? null : resultData.getData();
        if (result.getResultCode() != Activity.RESULT_OK || destination == null) {
            saving.set(false);
            call.resolve(new JSObject().put("saved", false));
            return;
        }

        bridge.execute(() -> {
            String json = call.getString("json", "");
            try (OutputStream output = getContext().getContentResolver().openOutputStream(destination, "w")) {
                if (output == null) throw new IOException("No document stream");
                output.write(json.getBytes(StandardCharsets.UTF_8));
            } catch (IOException | SecurityException exception) {
                call.reject("Android could not write the snapshot. Choose another location and try again.");
                return;
            } finally {
                saving.set(false);
            }
            call.resolve(new JSObject().put("saved", true));
        });
    }
}
