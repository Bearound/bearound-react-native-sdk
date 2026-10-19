# WorkManager 2.10 brings Room 2.6.1, whose consumer rule keeps this generated
# database class but not its reflective no-argument constructor under modern R8.
-keep class androidx.work.impl.WorkDatabase_Impl {
    public <init>();
}
