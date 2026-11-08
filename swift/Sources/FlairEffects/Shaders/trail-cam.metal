// flair-metal-hash: 0ab12769
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
    packed_float3 uTint;
    float uInterval;
    float uGrain;
    float uFlash;
    uint uFigure;
    float uMonth;
    float uDay;
    float uYear;
    float uClock;
    char _m22_pad[4];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

constant spvUnsafeArray<int, 10> _348 = spvUnsafeArray<int, 10>({ 63, 6, 91, 79, 102, 109, 125, 7, 127, 111 });

struct flair_trail_cam_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _149)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_149.uBackdrop) * _149.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_149.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _149)
{
    float4 _291;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _291 = overBackdrop(param, _149);
    }
    else
    {
        float2 param_1 = fract(uv);
        _291 = float4(testCard(param_1), 1.0);
    }
    return _291;
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float smin(thread const float& a, thread const float& b, thread const float& k)
{
    float h = fast::clamp(0.5 + ((0.5 * (b - a)) / k), 0.0, 1.0);
    return mix(b, a, h) - ((k * h) * (1.0 - h));
}

static inline __attribute__((always_inline))
float figure(thread const float2& q)
{
    float head = length(q - float2(0.0, 0.3300000131130218505859375)) - 0.0949999988079071044921875;
    float shoulders = (length((q - float2(0.0, 0.119999997317790985107421875)) / float2(0.17000000178813934326171875, 0.085000000894069671630859375)) - 1.0) * 0.085000000894069671630859375;
    float robe = fast::max(abs(q.x) - (0.1500000059604644775390625 + (0.119999997317790985107421875 * (0.119999997317790985107421875 - q.y))), q.y - 0.119999997317790985107421875);
    float param = head;
    float param_1 = shoulders;
    float param_2 = 0.0599999986588954925537109375;
    float param_3 = smin(param, param_1, param_2);
    float param_4 = robe;
    float param_5 = 0.039999999105930328369140625;
    return smin(param_3, param_4, param_5);
}

static inline __attribute__((always_inline))
float segDist(thread const float2& p, thread const float2& a, thread const float2& b)
{
    float2 pa = p - a;
    float2 ba = b - a;
    return length(pa - (ba * fast::clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)));
}

static inline __attribute__((always_inline))
float digit7(thread const float2& p, thread const int& d)
{
    int m = _348[clamp(d, 0, 9)];
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
    bool _461 = q.y < (-0.300000011920928955078125);
    bool _469;
    if (!_461)
    {
        _469 = q.y > 2.2999999523162841796875;
    }
    else
    {
        _469 = _461;
    }
    bool _476;
    if (!_469)
    {
        _476 = q.x < (-0.300000011920928955078125);
    }
    else
    {
        _476 = _469;
    }
    bool _484;
    if (!_476)
    {
        _484 = q.x > 12.80000019073486328125;
    }
    else
    {
        _484 = _476;
    }
    if (_484)
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
        int _548;
        if (slot < 2)
        {
            _548 = h;
        }
        else
        {
            _548 = (slot < 5) ? m : s;
        }
        int v = _548;
        int _569;
        if (((slot == 0) || (slot == 3)) || (slot == 6))
        {
            _569 = v / 10;
        }
        else
        {
            _569 = v - ((v / 10) * 10);
        }
        int d = _569;
        float2 param = c;
        int param_1 = d;
        dist = digit7(param, param_1);
    }
    return smoothstep(0.20000000298023223876953125, 0.119999997317790985107421875, dist);
}

static inline __attribute__((always_inline))
float stampInk(thread const float2& q, thread const float& secs, constant FlairUniforms& _149)
{
    bool _594 = q.y < (-0.300000011920928955078125);
    bool _601;
    if (!_594)
    {
        _601 = q.y > 2.2999999523162841796875;
    }
    else
    {
        _601 = _594;
    }
    bool _608;
    if (!_601)
    {
        _608 = q.x < (-0.300000011920928955078125);
    }
    else
    {
        _608 = _601;
    }
    if (_608)
    {
        return 0.0;
    }
    int slot = int(floor(q.x / 1.60000002384185791015625));
    float2 c = float2(q.x - (float(slot) * 1.60000002384185791015625), q.y);
    float dist = 100000.0;
    int month = int(_149.uMonth + 0.5);
    int day = int(_149.uDay + 0.5);
    int year = int(_149.uYear + 0.5);
    if ((slot == 2) || (slot == 5))
    {
        float2 param = c;
        float2 param_1 = float2(0.100000001490116119384765625, 0.0);
        float2 param_2 = float2(0.89999997615814208984375, 2.0);
        dist = segDist(param, param_1, param_2);
    }
    else
    {
        if (slot < 10)
        {
            int _671;
            if (slot < 2)
            {
                _671 = month;
            }
            else
            {
                _671 = (slot < 5) ? day : year;
            }
            int v = _671;
            int _688;
            if ((slot == 0) || (slot == 3))
            {
                _688 = 10;
            }
            else
            {
                int _697;
                if ((slot == 1) || (slot == 4))
                {
                    _697 = 1;
                }
                else
                {
                    int _703;
                    if (slot == 6)
                    {
                        _703 = 1000;
                    }
                    else
                    {
                        int _710;
                        if (slot == 7)
                        {
                            _710 = 100;
                        }
                        else
                        {
                            _710 = (slot == 8) ? 10 : 1;
                        }
                        _703 = _710;
                    }
                    _697 = _703;
                }
                _688 = _697;
            }
            int place = _688;
            float2 param_3 = c;
            int param_4 = (v / place) - ((v / (place * 10)) * 10);
            dist = digit7(param_3, param_4);
        }
        else
        {
            if (slot >= 12)
            {
                float2 param_5 = q - float2(19.200000762939453125, 0.0);
                float param_6 = secs;
                return clockInk(param_5, param_6);
            }
        }
    }
    return smoothstep(0.20000000298023223876953125, 0.119999997317790985107421875, dist);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _149, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_149.iResolution[0], _149.iResolution[1]);
    float aspect = _149.iResolution[0u] / _149.iResolution[1u];
    float shot = floor(_149.iTime / _149.uInterval);
    float2 param = float2(shot, 3.0);
    float2 shake = (hash22(param) - float2(0.5)) * 0.006000000052154064178466796875;
    float2 param_1 = uv + shake;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param_1, _149);
    float l = dot(pic.xyz, float3(0.1500000059604644775390625, 0.75, 0.100000001490116119384765625));
    float2 param_2 = float2(shot, 7.0);
    l = smoothstep(0.0500000007450580596923828125, 0.85000002384185791015625, l) * (0.85000002384185791015625 + (0.25 * hash12(param_2)));
    float2 p = (fragCoord - (float2(_149.iResolution[0], _149.iResolution[1]) * 0.5)) / float2(_149.iResolution[1u]);
    float k = mod(shot, 8.0);
    if ((_149.uFigure != 0u) && (k >= 4.0))
    {
        float i = k - 4.0;
        float _909;
        if (i == 0.0)
        {
            _909 = 0.319999992847442626953125;
        }
        else
        {
            float _915;
            if (i == 1.0)
            {
                _915 = 0.4799999892711639404296875;
            }
            else
            {
                _915 = (i == 2.0) ? 0.7200000286102294921875 : 1.5;
            }
            _909 = _915;
        }
        float size = _909;
        float _928;
        if (i == 0.0)
        {
            _928 = 0.4199999868869781494140625;
        }
        else
        {
            float _934;
            if (i == 1.0)
            {
                _934 = -0.2800000011920928955078125;
            }
            else
            {
                _934 = (i == 2.0) ? 0.119999997317790985107421875 : (-0.0500000007450580596923828125);
            }
            _928 = _934;
        }
        float _947;
        if (i == 3.0)
        {
            _947 = -0.300000011920928955078125;
        }
        else
        {
            _947 = ((-0.5) + (0.5 * size)) - 0.0199999995529651641845703125;
        }
        float2 at = float2(_928, _947);
        float2 q = (p - at) / float2(size);
        float2 param_3 = q;
        float d = figure(param_3);
        l = mix(l, 0.07999999821186065673828125 + (0.0500000007450580596923828125 * l), smoothstep(0.01200000010430812835693359375, -0.0040000001899898052215576171875, d) * smoothstep(-0.550000011920928955078125, -0.3499999940395355224609375, q.y));
        float2 e = q - float2(0.0, 0.3350000083446502685546875);
        e.x = abs(e.x) - 0.037000000476837158203125;
        l += (1.60000002384185791015625 * exp((-length(e)) / 0.0089999996125698089599609375));
    }
    l *= mix(1.0, 1.35000002384185791015625 * exp((-length(p * float2(0.800000011920928955078125, 1.0))) * 1.60000002384185791015625), _149.uFlash);
    float2 param_4 = fragCoord + float2(shot * 41.0);
    l += (((hash12(param_4) - 0.5) * 0.2199999988079071044921875) * _149.uGrain);
    float3 col = float3(_149.uTint) * fast::clamp(l, 0.0, 1.0);
    float unit = _149.iResolution[1u] * 0.01600000075995922088623046875;
    float bar = step(fragCoord.y, unit * 4.400000095367431640625);
    col = mix(col, float3(0.0199999995529651641845703125), float3(bar * 0.85000002384185791015625));
    float secs = (_149.uClock * 3600.0) + (shot * 17.0);
    float2 param_5 = (fragCoord - float2(unit * 2.0, unit * 1.2000000476837158203125)) / float2(unit);
    float param_6 = secs;
    float ink = stampInk(param_5, param_6, _149);
    col = mix(col, float3(1.0), float3(ink));
    fragColor = float4(col, fast::max(pic.w, fast::max(bar * 0.85000002384185791015625, ink)));
}

fragment flair_trail_cam_frag_out flair_trail_cam_frag(constant FlairUniforms& _149 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_trail_cam_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1115;
    if (_149.flair_flipY > 0.5)
    {
        _1115 = _149.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1115 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1115);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _149, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

