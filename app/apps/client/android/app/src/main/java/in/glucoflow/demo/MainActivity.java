package in.glucoflow.demo;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CareSnapshotPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
