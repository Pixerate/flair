// flair-metal-hash: 6eb7addd
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
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
    float3 uBackground;
    float3 uSun;
    packed_float3 uOrbit;
    int uPlanets;
    float uSpeed;
    float uTilt;
    float uZoom;
    float uOrbitOpacity;
    float uPlanetSize;
    float uBackgroundAlpha;
};

constant spvUnsafeArray<float, 8> _552 = spvUnsafeArray<float, 8>({ 0.0350000001490116119384765625, 0.0500000007450580596923828125, 0.054999999701976776123046875, 0.0419999994337558746337890625, 0.10999999940395355224609375, 0.0949999988079071044921875, 0.070000000298023223876953125, 0.06800000369548797607421875 });
constant spvUnsafeArray<float3, 8> _740 = spvUnsafeArray<float3, 8>({ float3(0.660000026226043701171875, 0.62000000476837158203125, 0.579999983310699462890625), float3(0.949999988079071044921875, 0.7799999713897705078125, 0.5), float3(0.300000011920928955078125, 0.550000011920928955078125, 0.949999988079071044921875), float3(0.85000002384185791015625, 0.4199999868869781494140625, 0.25), float3(0.86000001430511474609375, 0.7200000286102294921875, 0.550000011920928955078125), float3(0.920000016689300537109375, 0.819999992847442626953125, 0.60000002384185791015625), float3(0.60000002384185791015625, 0.87999999523162841796875, 0.920000016689300537109375), float3(0.319999992847442626953125, 0.449999988079071044921875, 0.949999988079071044921875) });

struct flair_solar_system_frag_out
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
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float stars(thread const float2& fragCoord, thread const float& density, constant FlairUniforms& _340)
{
    float2 cell = floor(fragCoord / float2(3.0));
    float2 param = cell;
    float h = hash12(param);
    float on = step(1.0 - (0.01200000010430812835693359375 * density), h);
    float2 param_1 = cell;
    float2 at = hash22(param_1) * 3.0;
    float d = length((fract(fragCoord / float2(3.0)) * 3.0) - at);
    float2 param_2 = cell + float2(7.0);
    return ((on * smoothstep(1.39999997615814208984375, 0.0, d)) * (0.4000000059604644775390625 + (0.60000002384185791015625 * hash12(param_2)))) * (0.75 + (0.25 * sin((_340.iTime * (1.0 + (3.0 * h))) + (h * 40.0))));
}

static inline __attribute__((always_inline))
float orbitRadius(thread const int& i)
{
    return (0.4199999868869781494140625 + (float(i) * 0.20000000298023223876953125)) + ((float(i) * float(i)) * 0.008000000379979610443115234375);
}

static inline __attribute__((always_inline))
float3 planetAt(thread const int& i, constant FlairUniforms& _340)
{
    int param = i;
    float r = orbitRadius(param);
    float a = ((((_340.iTime * _340.uSpeed) * 0.60000002384185791015625) / powr(r / 0.4199999868869781494140625, 1.5)) + (float(i) * 2.400000095367431640625)) + 0.699999988079071044921875;
    return float3(cos(a), 0.0, sin(a)) * r;
}

static inline __attribute__((always_inline))
float2 sphereHit(thread const float3& ro, thread const float3& rd, thread const float& r)
{
    float b = dot(ro, rd);
    float c = dot(ro, ro) - (r * r);
    float h = (b * b) - c;
    if (h < 0.0)
    {
        return float2(1000000000.0, -1000000000.0);
    }
    h = sqrt(h);
    return float2((-b) - h, (-b) + h);
}

static inline __attribute__((always_inline))
float hash13(thread float3& p3)
{
    p3 = fract(p3 * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.zyx + float3(31.31999969482421875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float vnoise3(thread const float3& p)
{
    float3 i = floor(p);
    float3 f = fract(p);
    float3 u = (f * f) * (float3(3.0) - (f * 2.0));
    float3 param = i;
    float _173 = hash13(param);
    float3 param_1 = i + float3(1.0, 0.0, 0.0);
    float _180 = hash13(param_1);
    float a = mix(_173, _180, u.x);
    float3 param_2 = i + float3(0.0, 1.0, 0.0);
    float _189 = hash13(param_2);
    float3 param_3 = i + float3(1.0, 1.0, 0.0);
    float _194 = hash13(param_3);
    float b = mix(_189, _194, u.x);
    float3 param_4 = i + float3(0.0, 0.0, 1.0);
    float _203 = hash13(param_4);
    float3 param_5 = i + float3(1.0, 0.0, 1.0);
    float _208 = hash13(param_5);
    float c = mix(_203, _208, u.x);
    float3 param_6 = i + float3(0.0, 1.0, 1.0);
    float _217 = hash13(param_6);
    float3 param_7 = i + float3(1.0);
    float _222 = hash13(param_7);
    float d = mix(_217, _222, u.x);
    return mix(mix(a, b, u.y), mix(c, d, u.y), u.z);
}

static inline __attribute__((always_inline))
float fbm3(thread float3& p, thread const int& octaves)
{
    float sum = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 6; i++)
    {
        if (i >= octaves)
        {
            break;
        }
        float3 param = p;
        sum += (amp * vnoise3(param));
        p = (p * 2.0299999713897705078125) + float3(11.69999980926513671875, 3.099999904632568359375, 7.900000095367431640625);
        amp *= 0.5;
    }
    return sum;
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _340)
{
    float px = 1.0 / _340.iResolution[1u];
    float2 p = (fragCoord - (float2(_340.iResolution[0], _340.iResolution[1]) * 0.5)) * px;
    float dist = 4.599999904632568359375 / _340.uZoom;
    float3 ro = float3(0.0, sin(_340.uTilt), cos(_340.uTilt)) * dist;
    float3 fw = fast::normalize(-ro);
    float3 rt = fast::normalize(cross(fw, float3(0.0, 1.0, 0.0)));
    float3 up = cross(rt, fw);
    float3 rd = fast::normalize(((rt * p.x) + (up * p.y)) + (fw * 1.7999999523162841796875));
    float2 param = fragCoord;
    float param_1 = 1.0;
    float3 col = _340.uBackground + float3(stars(param, param_1, _340));
    float sunR = 0.17000000178813934326171875;
    float tBest = 1000000000.0;
    int best = -1;
    for (int i = 0; i < 8; i++)
    {
        if (i >= _340.uPlanets)
        {
            break;
        }
        int param_2 = i;
        float3 param_3 = ro - planetAt(param_2, _340);
        float3 param_4 = rd;
        float param_5 = _552[i] * _340.uPlanetSize;
        float2 h = sphereHit(param_3, param_4, param_5);
        bool _571 = h.x < h.y;
        bool _577;
        if (_571)
        {
            _577 = h.x > 0.0;
        }
        else
        {
            _577 = _571;
        }
        bool _584;
        if (_577)
        {
            _584 = h.x < tBest;
        }
        else
        {
            _584 = _577;
        }
        if (_584)
        {
            tBest = h.x;
            best = i;
        }
    }
    float3 param_6 = ro;
    float3 param_7 = rd;
    float param_8 = sunR;
    float2 sunHit = sphereHit(param_6, param_7, param_8);
    float _606;
    if (sunHit.x < sunHit.y)
    {
        _606 = sunHit.x;
    }
    else
    {
        _606 = 1000000000.0;
    }
    float tSun = _606;
    float tPlane = (-ro.y) / rd.y;
    bool _621 = tPlane > 0.0;
    bool _629;
    if (_621)
    {
        _629 = tPlane < fast::min(tBest, tSun);
    }
    else
    {
        _629 = _621;
    }
    if (_629)
    {
        float3 q = ro + (rd * tPlane);
        float r = length(q.xz);
        float w = fwidth(r);
        float lines = 0.0;
        for (int i_1 = 0; i_1 < 8; i_1++)
        {
            if (i_1 >= _340.uPlanets)
            {
                break;
            }
            int param_9 = i_1;
            lines = fast::max(lines, 1.0 - smoothstep(0.5, 1.5, abs(r - orbitRadius(param_9)) / fast::max(w, 9.9999997473787516355514526367188e-06)));
        }
        col += ((float3(_340.uOrbit) * lines) * _340.uOrbitOpacity);
    }
    if ((best >= 0) && (tBest < tSun))
    {
        int param_10 = best;
        float3 c = planetAt(param_10, _340);
        float3 pos = ro + (rd * tBest);
        float3 n = fast::normalize(pos - c);
        float3 l = fast::normalize(-c);
        float3 base = _740[best];
        if (best >= 4)
        {
            float3 param_11 = n * 4.0;
            base *= (0.85000002384185791015625 + (0.25 * sin(((n.y * 26.0) + float(best)) + (2.0 * vnoise3(param_11)))));
        }
        if (best == 2)
        {
            float3 param_12 = (n * 3.0) + float3(2.0);
            base = mix(base, float3(0.300000011920928955078125, 0.60000002384185791015625, 0.300000011920928955078125), float3(smoothstep(0.5, 0.60000002384185791015625, vnoise3(param_12))));
        }
        float diff = fast::max(dot(n, l), 0.0);
        col = (base * (0.039999999105930328369140625 + (0.959999978542327880859375 * diff))) + (((_340.uSun * powr(1.0 - fast::max(dot(n, -rd), 0.0), 3.0)) * diff) * 0.4000000059604644775390625);
    }
    else
    {
        if (tSun < 100000000.0)
        {
            float3 n_1 = fast::normalize(ro + (rd * tSun));
            float3 param_13 = (n_1 * 6.0) + float3(0.0, _340.iTime * 0.1500000059604644775390625, 0.0);
            int param_14 = 4;
            float _838 = fbm3(param_13, param_14);
            float boil = _838;
            float limb = fast::max(dot(n_1, -rd), 0.0);
            col = ((_340.uSun * (0.699999988079071044921875 + (0.800000011920928955078125 * boil))) * (0.550000011920928955078125 + (0.449999988079071044921875 * limb))) + ((float3(1.0, 0.949999988079071044921875, 0.800000011920928955078125) * powr(limb, 3.0)) * 0.5);
        }
    }
    if (_340.uPlanets >= 6)
    {
        int param_15 = 5;
        float3 c_1 = planetAt(param_15, _340);
        float t = (-ro.y) / rd.y;
        bool _879 = t > 0.0;
        bool _895;
        if (_879)
        {
            float _886;
            if (best == 5)
            {
                _886 = tBest + 0.0;
            }
            else
            {
                _886 = 1000000000.0;
            }
            _895 = t < fast::min(tSun, _886);
        }
        else
        {
            _895 = _879;
        }
        if (_895)
        {
            float r_1 = length((ro + (rd * t)) - c_1) / (0.0949999988079071044921875 * _340.uPlanetSize);
            float ring = (smoothstep(1.35000002384185791015625, 1.4500000476837158203125, r_1) * smoothstep(2.2999999523162841796875, 2.150000095367431640625, r_1)) * (0.60000002384185791015625 + (0.4000000059604644775390625 * sin(r_1 * 40.0)));
            if ((best != 5) || (t < tBest))
            {
                col = mix(col, float3(0.874000012874603271484375, 0.778999984264373779296875, 0.569999992847442626953125), float3(ring * 0.75));
            }
        }
    }
    float closest = length(ro - (rd * dot(ro, rd)));
    col += ((_340.uSun * exp((-fast::max(closest - sunR, 0.0)) * 9.0)) * 0.60000002384185791015625);
    col += ((_340.uSun * exp((-fast::max(closest - sunR, 0.0)) * 40.0)) * 0.60000002384185791015625);
    fragColor = float4(col, 1.0);
}

static inline __attribute__((always_inline))
float4 flair_backgroundOpacity(thread const float4& c, thread const float3& bg, thread const float& opacity)
{
    if (opacity >= 1.0)
    {
        return c;
    }
    float3 d = fast::clamp(c.xyz, float3(0.0), float3(1.0)) - bg;
    float3 room = mix(bg, float3(1.0) - bg, step(float3(0.0), d));
    float3 k = abs(d) / fast::max(room, float3(9.9999997473787516355514526367188e-05));
    float a = fast::clamp(fast::max(k.x, fast::max(k.y, k.z)), 0.0, 1.0);
    float3 _1029;
    if (a > 0.0)
    {
        _1029 = bg + (d / float3(a));
    }
    else
    {
        _1029 = bg;
    }
    float3 fg = _1029;
    float alpha = a + (opacity * (1.0 - a));
    float3 _1051;
    if (alpha > 0.0)
    {
        _1051 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _1051 = bg;
    }
    float3 col = _1051;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _340)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _340);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _340.uBackground;
    float param_4 = _340.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_solar_system_frag_out flair_solar_system_frag(constant FlairUniforms& _340 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_solar_system_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1108;
    if (_340.flair_flipY > 0.5)
    {
        _1108 = _340.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1108 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1108);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _340);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

