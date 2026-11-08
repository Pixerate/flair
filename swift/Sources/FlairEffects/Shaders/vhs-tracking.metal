// flair-metal-hash: cf1ade20
#pragma clang diagnostic ignored "-Wmissing-prototypes"
#pragma clang diagnostic ignored "-Wmissing-braces"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

template<typename T, size_t Num>
struct spvUnsafeArray
{
    T elements[Num ? Num : 1];
    
    thread T& operator [] (size_t pos) thread
    {
        return elements[pos];
    }
    constexpr const thread T& operator [] (size_t pos) const thread
    {
        return elements[pos];
    }
    
    device T& operator [] (size_t pos) device
    {
        return elements[pos];
    }
    constexpr const device T& operator [] (size_t pos) const device
    {
        return elements[pos];
    }
    
    constexpr const constant T& operator [] (size_t pos) const constant
    {
        return elements[pos];
    }
    
    threadgroup T& operator [] (size_t pos) threadgroup
    {
        return elements[pos];
    }
    constexpr const threadgroup T& operator [] (size_t pos) const threadgroup
    {
        return elements[pos];
    }
};

// Implementation of the GLSL mod() function, which is slightly different than Metal fmod()
template<typename Tx, typename Ty>
inline Tx mod(Tx x, Ty y)
{
    return x - y * floor(x / y);
}

struct FlairUniforms
{
    packed_float3 iResolution;
    float iTime;
    float iTimeDelta;
    int iFrame;
    float iBeat;
    float flair_flipY;
    float4 iMouse;
    float4 iPointer;
    float4 iClicks[8];
    float4 iTrail[32];
    float4 iAudio;
    float4 iSpectrum[16];
    float4 iScroll;
    float uWarp;
    float uTracking;
    float uHeadSwitch;
    float uBleed;
    float uNoise;
    uint uOsd;
    char _m19_pad[8];
    packed_float3 uOsdColor;
    float uClock;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

constant spvUnsafeArray<int, 10> _395 = spvUnsafeArray<int, 10>({ 63, 6, 91, 79, 102, 109, 125, 7, 127, 111 });

struct flair_vhs_tracking_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float vnoise(thread const float2& p)
{
    float2 i = floor(p);
    float2 f = fract(p);
    float2 u = (f * f) * (float2(3.0) - (f * 2.0));
    float2 param = i;
    float a = hash12(param);
    float2 param_1 = i + float2(1.0, 0.0);
    float b = hash12(param_1);
    float2 param_2 = i + float2(0.0, 1.0);
    float c = hash12(param_2);
    float2 param_3 = i + float2(1.0);
    float d = hash12(param_3);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _192)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_192.uBackdrop) * _192.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_192.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

static inline __attribute__((always_inline))
float3 testCard(thread const float2& uv)
{
    float3 sky = mix(float3(0.980000019073486328125, 0.62000000476837158203125, 0.4199999868869781494140625), float3(0.23999999463558197021484375, 0.319999992847442626953125, 0.7200000286102294921875), float3(uv.y));
    float sun = smoothstep(0.1599999964237213134765625, 0.1500000059604644775390625, length((uv - float2(0.64999997615814208984375, 0.579999983310699462890625)) * float2(1.60000002384185791015625, 1.0)));
    float hills = step(uv.y, (0.319999992847442626953125 + (0.0599999986588954925537109375 * sin(uv.x * 9.0))) + (0.039999999105930328369140625 * sin((uv.x * 23.0) + 1.0)));
    float3 col = mix(sky, float3(1.0, 0.920000016689300537109375, 0.699999988079071044921875), float3(sun));
    col = mix(col, float3(0.119999997317790985107421875, 0.2800000011920928955078125, 0.23999999463558197021484375) + float3(0.07999999821186065673828125 * sin(uv.x * 40.0)), float3(hills));
    float2 grid = abs(fract(uv * 8.0) - float2(0.5));
    col += float3(0.039999999105930328369140625 * step(0.4799999892711639404296875, fast::max(grid.x, grid.y)));
    return col;
}

static inline __attribute__((always_inline))
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _192)
{
    float4 _333;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _333 = overBackdrop(param, _192);
    }
    else
    {
        float2 param_1 = fract(uv);
        _333 = float4(testCard(param_1), 1.0);
    }
    return _333;
}

static inline __attribute__((always_inline))
float3 picture(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _192)
{
    float2 param = uv;
    return pictureRGBA(tex, texSmplr, param, _192).xyz;
}

static inline __attribute__((always_inline))
float3 toYiq(thread const float3& c)
{
    return float3x3(float3(0.2989999949932098388671875, 0.596000015735626220703125, 0.2109999954700469970703125), float3(0.58700001239776611328125, -0.273999989032745361328125, -0.5230000019073486328125), float3(0.114000000059604644775390625, -0.3219999969005584716796875, 0.3120000064373016357421875)) * c;
}

static inline __attribute__((always_inline))
float3 fromYiq(thread const float3& c)
{
    return float3x3(float3(1.0), float3(0.95599997043609619140625, -0.272000014781951904296875, -1.10599994659423828125), float3(0.620999991893768310546875, -0.647000014781951904296875, 1.70299994945526123046875)) * c;
}

static inline __attribute__((always_inline))
float segDist(thread const float2& p, thread const float2& a, thread const float2& b)
{
    float2 pa = p - a;
    float2 ba = b - a;
    return length(pa - (ba * fast::clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)));
}

static inline __attribute__((always_inline))
float letterDist(thread const float2& p, thread const int& k)
{
    float2 param = p;
    float2 param_1 = float2(0.0);
    float2 param_2 = float2(0.0, 2.0);
    float d = segDist(param, param_1, param_2);
    float2 param_3 = p;
    float2 param_4 = float2(0.0, 2.0);
    float2 param_5 = float2(1.0, 2.0);
    d = fast::min(d, segDist(param_3, param_4, param_5));
    if (k == 0)
    {
        float2 param_6 = p;
        float2 param_7 = float2(1.0, 2.0);
        float2 param_8 = float2(1.0);
        d = fast::min(d, segDist(param_6, param_7, param_8));
        float2 param_9 = p;
        float2 param_10 = float2(0.0, 1.0);
        float2 param_11 = float2(1.0);
        d = fast::min(d, segDist(param_9, param_10, param_11));
        float2 param_12 = p;
        float2 param_13 = float2(0.300000011920928955078125, 1.0);
        float2 param_14 = float2(1.0, 0.0);
        d = fast::min(d, segDist(param_12, param_13, param_14));
    }
    else
    {
        float2 param_15 = p;
        float2 param_16 = float2(0.0);
        float2 param_17 = float2(1.0, 0.0);
        d = fast::min(d, segDist(param_15, param_16, param_17));
        if (k == 1)
        {
            float2 param_18 = p;
            float2 param_19 = float2(0.0, 1.0);
            float2 param_20 = float2(0.800000011920928955078125, 1.0);
            d = fast::min(d, segDist(param_18, param_19, param_20));
        }
    }
    return d;
}

static inline __attribute__((always_inline))
float digit7(thread const float2& p, thread const int& d)
{
    int m = _395[clamp(d, 0, 9)];
    float dist = 100000.0;
    if ((m & 1) != 0)
    {
        float2 param = p;
        float2 param_1 = float2(0.0, 2.0);
        float2 param_2 = float2(1.0, 2.0);
        dist = fast::min(dist, segDist(param, param_1, param_2));
    }
    if ((m & 2) != 0)
    {
        float2 param_3 = p;
        float2 param_4 = float2(1.0, 2.0);
        float2 param_5 = float2(1.0);
        dist = fast::min(dist, segDist(param_3, param_4, param_5));
    }
    if ((m & 4) != 0)
    {
        float2 param_6 = p;
        float2 param_7 = float2(1.0);
        float2 param_8 = float2(1.0, 0.0);
        dist = fast::min(dist, segDist(param_6, param_7, param_8));
    }
    if ((m & 8) != 0)
    {
        float2 param_9 = p;
        float2 param_10 = float2(0.0);
        float2 param_11 = float2(1.0, 0.0);
        dist = fast::min(dist, segDist(param_9, param_10, param_11));
    }
    if ((m & 16) != 0)
    {
        float2 param_12 = p;
        float2 param_13 = float2(0.0);
        float2 param_14 = float2(0.0, 1.0);
        dist = fast::min(dist, segDist(param_12, param_13, param_14));
    }
    if ((m & 32) != 0)
    {
        float2 param_15 = p;
        float2 param_16 = float2(0.0, 1.0);
        float2 param_17 = float2(0.0, 2.0);
        dist = fast::min(dist, segDist(param_15, param_16, param_17));
    }
    if ((m & 64) != 0)
    {
        float2 param_18 = p;
        float2 param_19 = float2(0.0, 1.0);
        float2 param_20 = float2(1.0);
        dist = fast::min(dist, segDist(param_18, param_19, param_20));
    }
    return dist;
}

static inline __attribute__((always_inline))
float clockInk(thread const float2& q, thread const float& secs)
{
    bool _568 = q.y < (-0.300000011920928955078125);
    bool _576;
    if (!_568)
    {
        _576 = q.y > 2.2999999523162841796875;
    }
    else
    {
        _576 = _568;
    }
    bool _583;
    if (!_576)
    {
        _583 = q.x < (-0.300000011920928955078125);
    }
    else
    {
        _583 = _576;
    }
    bool _591;
    if (!_583)
    {
        _591 = q.x > 12.80000019073486328125;
    }
    else
    {
        _591 = _583;
    }
    if (_591)
    {
        return 0.0;
    }
    int slot = int(floor(q.x / 1.60000002384185791015625));
    float2 c = float2(q.x - (float(slot) * 1.60000002384185791015625), q.y);
    int h = int(mod(floor(secs / 3600.0), 24.0));
    int m = int(mod(floor(secs / 60.0), 60.0));
    int s = int(mod(floor(secs), 60.0));
    float dist = 100000.0;
    if ((slot == 2) || (slot == 5))
    {
        dist = fast::min(length(c - float2(0.5, 0.60000002384185791015625)), length(c - float2(0.5, 1.39999997615814208984375)));
    }
    else
    {
        int _655;
        if (slot < 2)
        {
            _655 = h;
        }
        else
        {
            _655 = (slot < 5) ? m : s;
        }
        int v = _655;
        int _676;
        if (((slot == 0) || (slot == 3)) || (slot == 6))
        {
            _676 = v / 10;
        }
        else
        {
            _676 = v - ((v / 10) * 10);
        }
        int d = _676;
        float2 param = c;
        int param_1 = d;
        dist = digit7(param, param_1);
    }
    return smoothstep(0.20000000298023223876953125, 0.119999997317790985107421875, dist);
}

static inline __attribute__((always_inline))
float2 camcorder(thread const float2& fragCoord, thread const float& unit, thread const float& secs, constant FlairUniforms& _192)
{
    float2 rec = (fragCoord - float2(unit * 4.19999980926513671875, _192.iResolution[1u] - (unit * 4.0))) / float2(unit);
    float white = 0.0;
    bool _718 = rec.y > (-0.300000011920928955078125);
    bool _724;
    if (_718)
    {
        _724 = rec.y < 2.2999999523162841796875;
    }
    else
    {
        _724 = _718;
    }
    bool _730;
    if (_724)
    {
        _730 = rec.x > (-0.300000011920928955078125);
    }
    else
    {
        _730 = _724;
    }
    bool _737;
    if (_730)
    {
        _737 = rec.x < 4.599999904632568359375;
    }
    else
    {
        _737 = _730;
    }
    if (_737)
    {
        int k = int(floor(rec.x / 1.60000002384185791015625));
        float2 param = rec - float2(float(k) * 1.60000002384185791015625, 0.0);
        int param_1 = k;
        white = smoothstep(0.20000000298023223876953125, 0.119999997317790985107421875, letterDist(param, param_1));
    }
    float spot = smoothstep(1.0, 0.85000002384185791015625, length((fragCoord - float2(unit * 2.599999904632568359375, _192.iResolution[1u] - (unit * 3.0))) / float2(unit)));
    float red = spot * step(0.5, fract(secs));
    float2 clock = (fragCoord - float2(_192.iResolution[0u] - (unit * 15.0), unit * 3.2000000476837158203125)) / float2(unit);
    float2 param_2 = clock;
    float param_3 = secs;
    white = fast::max(white, clockInk(param_2, param_3));
    return float2(white, red);
}

static inline __attribute__((always_inline))
float4 osdOver(thread float3& col, thread const float& alpha, thread const float2& fragCoord, thread const float& shift, constant FlairUniforms& _192)
{
    if (!(_192.uOsd != 0u))
    {
        return float4(col, alpha);
    }
    float unit = _192.iResolution[1u] * 0.017999999225139617919921875;
    float secs = (_192.uClock * 3600.0) + _192.iTime;
    float2 at = fragCoord + float2(shift, 0.0);
    float2 param = at + (float2(-0.25, 0.25) * unit);
    float param_1 = unit;
    float param_2 = secs;
    float2 shadow = camcorder(param, param_1, param_2, _192);
    float2 param_3 = at;
    float param_4 = unit;
    float param_5 = secs;
    float2 ink = camcorder(param_3, param_4, param_5, _192);
    col = mix(col, float3(0.0), float3(0.5 * fast::max(shadow.x, shadow.y)));
    col = mix(col, float3(_192.uOsdColor), float3(ink.x));
    col = mix(col, float3(1.0, 0.100000001490116119384765625, 0.07999999821186065673828125), float3(ink.y));
    return float4(col, fast::max(alpha, fast::max(0.5 * fast::max(shadow.x, shadow.y), fast::max(ink.x, ink.y))));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _192, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_192.iResolution[0], _192.iResolution[1]);
    float frame = floor(_192.iTime * 30.0);
    float line = floor(uv.y * 240.0);
    float2 param = float2(uv.y * 14.0, _192.iTime * 1.7000000476837158203125);
    float shift = _192.uWarp * ((0.0040000001899898052215576171875 * sin((uv.y * 6.0) + (_192.iTime * 1.2999999523162841796875))) + (0.006000000052154064178466796875 * (vnoise(param) - 0.5)));
    float at = (fract(_192.iTime * 0.10999999940395355224609375) * 1.39999997615814208984375) - 0.20000000298023223876953125;
    float band = exp(-powr((uv.y - at) / 0.039999999105930328369140625, 2.0)) * _192.uTracking;
    float2 param_1 = float2(line, frame);
    shift += ((band * (hash12(param_1) - 0.300000011920928955078125)) * 0.070000000298023223876953125);
    float tear = (1.0 - smoothstep(0.0199999995529651641845703125, 0.0500000007450580596923828125, uv.y)) * _192.uHeadSwitch;
    float2 param_2 = float2(line, frame + 3.0);
    shift += (tear * (0.0199999995529651641845703125 + (0.039999999105930328369140625 * hash12(param_2))));
    float2 param_3 = float2(line, frame + 7.0);
    shift += (((hash12(param_3) - 0.5) * 0.00200000009499490261077880859375) * _192.uNoise);
    float2 st = uv + float2(shift, 0.0);
    float2 param_4 = st;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param_4, _192);
    float3 iq = float3(0.0);
    for (int k = 1; k < 5; k++)
    {
        float2 param_5 = st - float2((float(k) * _192.uBleed) * 0.5, 0.0);
        float3 param_6 = picture(uImage, uImageSmplr, param_5, _192);
        iq += toYiq(param_6);
    }
    float3 param_7 = pic.xyz;
    iq = (iq + toYiq(param_7)) / float3(5.0);
    float3 param_8 = float3(dot(pic.xyz, float3(0.2989999949932098388671875, 0.58700001239776611328125, 0.114000000059604644775390625)), iq.yz * 1.14999997615814208984375);
    float3 col = fromYiq(param_8);
    float2 param_9 = fragCoord + float2(frame * 17.0);
    float snow = hash12(param_9);
    float2 param_10 = float2(floor(fragCoord.x / 3.0), line + frame);
    col = mix(col, float3(snow), float3(fast::clamp(((band * 0.699999988079071044921875) * step(0.449999988079071044921875, hash12(param_10))) + (tear * 0.3499999940395355224609375), 0.0, 1.0)));
    col += float3(((snow - 0.5) * 0.100000001490116119384765625) * _192.uNoise);
    float2 param_11 = float2(floor(fragCoord.x / 8.0), line + (frame * 31.0));
    col += float3((step(0.9993000030517578125 - (0.001000000047497451305389404296875 * _192.uNoise), hash12(param_11)) * 0.800000011920928955078125) * _192.uNoise);
    col = ((mix(float3(dot(col, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875))), col, float3(0.800000011920928955078125)) * float3(0.9700000286102294921875, 1.0, 1.03999996185302734375)) * 0.920000016689300537109375) + float3(0.039999999105930328369140625);
    col *= (0.939999997615814208984375 + (0.0599999986588954925537109375 * sin(fragCoord.y * 3.141590118408203125)));
    float2 v = uv - float2(0.5);
    col *= (1.0 - (0.449999988079071044921875 * dot(v, v)));
    float3 param_12 = fast::clamp(col, float3(0.0), float3(1.0));
    float param_13 = pic.w;
    float2 param_14 = fragCoord;
    float param_15 = (-shift) * _192.iResolution[0u];
    float4 _1246 = osdOver(param_12, param_13, param_14, param_15, _192);
    fragColor = _1246;
}

fragment flair_vhs_tracking_frag_out flair_vhs_tracking_frag(constant FlairUniforms& _192 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_vhs_tracking_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1258;
    if (_192.flair_flipY > 0.5)
    {
        _1258 = _192.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1258 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1258);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _192, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

