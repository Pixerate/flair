// flair-metal-hash: a820495c
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
    int uCount;
    float uCard;
    float uAspect;
    float uSpread;
    float uTilt;
    float uHelix;
    float uHold;
    float uFade;
    float uReflect;
    float uRadius;
    float3 uBack;
    packed_float3 uBackground;
    float uBackgroundAlpha;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_orbit_gallery_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float ease(thread float& t)
{
    t = fast::clamp(t, 0.0, 1.0);
    return (t * t) * (3.0 - (2.0 * t));
}

static inline __attribute__((always_inline))
float4 cardAt(thread const int& i, thread const int& n, thread const float& spin, thread const float& radius, thread const float& ch, constant FlairUniforms& _115)
{
    float a = ((6.28318023681640625 * float(i)) / float(n)) - spin;
    float around = mod(a + 3.141590118408203125, 6.28318023681640625) - 3.141590118408203125;
    return float4(radius * sin(a), (((_115.uHelix * ch) * around) / 6.28318023681640625) * float(n), radius * cos(a), a);
}

static inline __attribute__((always_inline))
float tileBox(thread const float2& p, thread const float2& b, thread const float& r)
{
    float2 q = (abs(p) - b) + float2(r);
    return (length(fast::max(q, float2(0.0))) + fast::min(fast::max(q.x, q.y), 0.0)) - r;
}

static inline __attribute__((always_inline))
float4 hitCard(thread const float3& ro, thread const float3& rd, thread const float4& c, thread const float2& half_, thread const float& px, constant FlairUniforms& _115)
{
    float3 nrm = float3(sin(c.w), 0.0, cos(c.w));
    float dn = dot(rd, nrm);
    if (abs(dn) < 9.9999997473787516355514526367188e-05)
    {
        return float4(0.0);
    }
    float t = dot(c.xyz - ro, nrm) / dn;
    if (t <= 0.0)
    {
        return float4(0.0);
    }
    float3 h = (ro + (rd * t)) - c.xyz;
    float2 q = float2(dot(h, float3(cos(c.w), 0.0, -sin(c.w))), h.y);
    float2 param = q;
    float2 param_1 = half_;
    float param_2 = (_115.uRadius * half_.y) * 2.0;
    float d = tileBox(param, param_1, param_2);
    float cover = smoothstep(px * t, (-px) * t, d);
    return float4((q / (half_ * 2.0)) + float2(0.5), t, cover);
}

static inline __attribute__((always_inline))
int2 itemSize(thread const int& i, texture2d<float> uItem0, sampler uItem0Smplr, texture2d<float> uItem1, sampler uItem1Smplr, texture2d<float> uItem2, sampler uItem2Smplr, texture2d<float> uItem3, sampler uItem3Smplr, texture2d<float> uItem4, sampler uItem4Smplr, texture2d<float> uItem5, sampler uItem5Smplr)
{
    if (i == 0)
    {
        return int2(uItem0.get_width(), uItem0.get_height());
    }
    if (i == 1)
    {
        return int2(uItem1.get_width(), uItem1.get_height());
    }
    if (i == 2)
    {
        return int2(uItem2.get_width(), uItem2.get_height());
    }
    if (i == 3)
    {
        return int2(uItem3.get_width(), uItem3.get_height());
    }
    if (i == 4)
    {
        return int2(uItem4.get_width(), uItem4.get_height());
    }
    return int2(uItem5.get_width(), uItem5.get_height());
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _115)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_115.uBackdrop) * _115.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_115.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _115)
{
    float4 _258;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _258 = overBackdrop(param, _115);
    }
    else
    {
        float2 param_1 = fract(uv);
        _258 = float4(testCard(param_1), 1.0);
    }
    return _258;
}

static inline __attribute__((always_inline))
float4 itemAt(thread const int& i, thread const float2& uv, constant FlairUniforms& _115, texture2d<float> uItem0, sampler uItem0Smplr, texture2d<float> uItem1, sampler uItem1Smplr, texture2d<float> uItem2, sampler uItem2Smplr, texture2d<float> uItem3, sampler uItem3Smplr, texture2d<float> uItem4, sampler uItem4Smplr, texture2d<float> uItem5, sampler uItem5Smplr)
{
    if (i == 0)
    {
        float2 param = uv;
        return pictureRGBA(uItem0, uItem0Smplr, param, _115);
    }
    if (i == 1)
    {
        float2 param_1 = uv;
        return pictureRGBA(uItem1, uItem1Smplr, param_1, _115);
    }
    if (i == 2)
    {
        float2 param_2 = uv;
        return pictureRGBA(uItem2, uItem2Smplr, param_2, _115);
    }
    if (i == 3)
    {
        float2 param_3 = uv;
        return pictureRGBA(uItem3, uItem3Smplr, param_3, _115);
    }
    if (i == 4)
    {
        float2 param_4 = uv;
        return pictureRGBA(uItem4, uItem4Smplr, param_4, _115);
    }
    float2 param_5 = uv;
    return pictureRGBA(uItem5, uItem5Smplr, param_5, _115);
}

static inline __attribute__((always_inline))
float4 itemCover(thread const int& i, thread float2& uv, thread const float& aspect, constant FlairUniforms& _115, texture2d<float> uItem0, sampler uItem0Smplr, texture2d<float> uItem1, sampler uItem1Smplr, texture2d<float> uItem2, sampler uItem2Smplr, texture2d<float> uItem3, sampler uItem3Smplr, texture2d<float> uItem4, sampler uItem4Smplr, texture2d<float> uItem5, sampler uItem5Smplr)
{
    int param = i;
    int2 ts = itemSize(param, uItem0, uItem0Smplr, uItem1, uItem1Smplr, uItem2, uItem2Smplr, uItem3, uItem3Smplr, uItem4, uItem4Smplr, uItem5, uItem5Smplr);
    bool _495 = ts.x > 1;
    bool _501;
    if (_495)
    {
        _501 = ts.y > 1;
    }
    else
    {
        _501 = _495;
    }
    if (_501)
    {
        float ta = float(ts.x) / float(ts.y);
        if (ta > aspect)
        {
            uv.x = (((uv.x - 0.5) * aspect) / ta) + 0.5;
        }
        else
        {
            uv.y = (((uv.y - 0.5) * ta) / aspect) + 0.5;
        }
    }
    int param_1 = i;
    float2 param_2 = uv;
    return itemAt(param_1, param_2, _115, uItem0, uItem0Smplr, uItem1, uItem1Smplr, uItem2, uItem2Smplr, uItem3, uItem3Smplr, uItem4, uItem4Smplr, uItem5, uItem5Smplr);
}

static inline __attribute__((always_inline))
float4 over(thread const float4& acc, thread const float3& c, thread const float& a)
{
    return float4((acc.xyz * (1.0 - a)) + (c * a), (acc.w * (1.0 - a)) + a);
}

static inline __attribute__((always_inline))
float4 traceCards(thread const float3& ro, thread const float3& rd, thread const int& n, thread const float& spin, thread const float& radius, thread const float2& half_, thread const float& px, constant FlairUniforms& _115, texture2d<float> uItem0, sampler uItem0Smplr, texture2d<float> uItem1, sampler uItem1Smplr, texture2d<float> uItem2, sampler uItem2Smplr, texture2d<float> uItem3, sampler uItem3Smplr, texture2d<float> uItem4, sampler uItem4Smplr, texture2d<float> uItem5, sampler uItem5Smplr)
{
    float4 acc = float4(0.0);
    spvUnsafeArray<float, 6> depths;
    float _693;
    for (int j = 0; j < 6; j++)
    {
        if (j < n)
        {
            _693 = cos(((6.28318023681640625 * float(j)) / float(n)) - spin) + (float(j) * 0.001000000047497451305389404296875);
        }
        else
        {
            _693 = 99.0;
        }
        depths[j] = _693;
    }
    float2 _837;
    float3 _860;
    float _877;
    for (int pass = 0; pass < 6; pass++)
    {
        if (pass >= n)
        {
            break;
        }
        int which = 0;
        for (int j_1 = 0; j_1 < 6; j_1++)
        {
            int rank = 0;
            for (int m = 0; m < 6; m++)
            {
                rank += int(depths[m] < depths[j_1]);
            }
            if ((j_1 < n) && (rank == pass))
            {
                which = j_1;
            }
        }
        int param = which;
        int param_1 = n;
        float param_2 = spin;
        float param_3 = radius;
        float param_4 = 2.0 * half_.y;
        float4 c = cardAt(param, param_1, param_2, param_3, param_4, _115);
        float3 param_5 = ro;
        float3 param_6 = rd;
        float4 param_7 = c;
        float2 param_8 = half_;
        float param_9 = px;
        float4 hit = hitCard(param_5, param_6, param_7, param_8, param_9, _115);
        if (hit.w <= 0.0)
        {
            continue;
        }
        float facing = cos(c.w);
        float shade = mix(1.0, 0.4000000059604644775390625 + (0.60000002384185791015625 * (0.5 + (0.5 * facing))), _115.uFade);
        float a = hit.w;
        bool back = dot(rd, float3(sin(c.w), 0.0, cos(c.w))) > 0.0;
        if (back)
        {
            _837 = float2(1.0 - hit.x, hit.y);
        }
        else
        {
            _837 = hit.xy;
        }
        int param_10 = which;
        float2 param_11 = _837;
        float param_12 = _115.uAspect;
        float4 _857 = itemCover(param_10, param_11, param_12, _115, uItem0, uItem0Smplr, uItem1, uItem1Smplr, uItem2, uItem2Smplr, uItem3, uItem3Smplr, uItem4, uItem4Smplr, uItem5, uItem5Smplr);
        float4 pic = _857;
        if (back)
        {
            _860 = mix(pic.xyz, _115.uBack, float3(0.64999997615814208984375));
        }
        else
        {
            _860 = pic.xyz;
        }
        float3 col = _860 * shade;
        if (back)
        {
            _877 = 1.0;
        }
        else
        {
            _877 = pic.w;
        }
        a *= _877;
        float4 param_13 = acc;
        float3 param_14 = col;
        float param_15 = a;
        acc = over(param_13, param_14, param_15);
    }
    return acc;
}

static inline __attribute__((always_inline))
float4 finish(thread const float4& acc, constant FlairUniforms& _115)
{
    float4 base = float4(float3(_115.uBackground) * _115.uBackgroundAlpha, _115.uBackgroundAlpha);
    float4 o = float4(acc.xyz + (base.xyz * (1.0 - acc.w)), acc.w + (base.w * (1.0 - acc.w)));
    return float4(o.xyz / float3(fast::max(o.w, 9.9999997473787516355514526367188e-05)), o.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _115, texture2d<float> uItem0, sampler uItem0Smplr, texture2d<float> uItem1, sampler uItem1Smplr, texture2d<float> uItem2, sampler uItem2Smplr, texture2d<float> uItem3, sampler uItem3Smplr, texture2d<float> uItem4, sampler uItem4Smplr, texture2d<float> uItem5, sampler uItem5Smplr)
{
    float2 p = (fragCoord - (float2(_115.iResolution[0], _115.iResolution[1]) * 0.5)) / float2(_115.iResolution[1u]);
    float px = 1.5 / (_115.iResolution[1u] * 2.0);
    int n = clamp(_115.uCount, 1, 6);
    float k = (((float(n) * _115.uAspect) * 1.25) * _115.uSpread) / 6.28318023681640625;
    float ch = (_115.uCard * 3.0) / (2.0 + (_115.uCard * k));
    float _948;
    if (n > 1)
    {
        _948 = k * ch;
    }
    else
    {
        _948 = 0.0;
    }
    float radius = _948;
    float2 half_ = float2(ch * _115.uAspect, ch) * 0.5;
    float c = _115.iTime / fast::max(_115.uHold, 0.100000001490116119384765625);
    float step_ = floor(c);
    float param = ((c - step_) - 0.60000002384185791015625) / 0.4000000059604644775390625;
    float _987 = ease(param);
    float spin = (6.28318023681640625 / float(n)) * (step_ + _987);
    float3 ro = float3(0.0, _115.uTilt * 3.0, 3.0);
    float3 fwd = fast::normalize(-ro);
    float3 right = fast::normalize(cross(fwd, float3(0.0, 1.0, 0.0)));
    float3 up = cross(right, fwd);
    float3 rd = fast::normalize(((fwd * 2.0) + (right * p.x)) + (up * p.y));
    float3 param_1 = ro;
    float3 param_2 = rd;
    int param_3 = n;
    float param_4 = spin;
    float param_5 = radius;
    float2 param_6 = half_;
    float param_7 = px;
    float4 acc = traceCards(param_1, param_2, param_3, param_4, param_5, param_6, param_7, _115, uItem0, uItem0Smplr, uItem1, uItem1Smplr, uItem2, uItem2Smplr, uItem3, uItem3Smplr, uItem4, uItem4Smplr, uItem5, uItem5Smplr);
    float floorY = ((-half_.y) - 0.0199999995529651641845703125) - (((0.5 * _115.uHelix) * ch) * float(n));
    bool _1057 = _115.uReflect > 0.0;
    bool _1064;
    if (_1057)
    {
        _1064 = acc.w < 0.999000012874603271484375;
    }
    else
    {
        _1064 = _1057;
    }
    bool _1070;
    if (_1064)
    {
        _1070 = rd.y < 0.0;
    }
    else
    {
        _1070 = _1064;
    }
    bool _1077;
    if (_1070)
    {
        _1077 = ro.y > floorY;
    }
    else
    {
        _1077 = _1070;
    }
    if (_1077)
    {
        float t = (floorY - ro.y) / rd.y;
        float3 fp = ro + (rd * t);
        float3 param_8 = fp;
        float3 param_9 = float3(rd.x, -rd.y, rd.z);
        int param_10 = n;
        float param_11 = spin;
        float param_12 = radius;
        float2 param_13 = half_;
        float param_14 = px;
        float4 mirror = traceCards(param_8, param_9, param_10, param_11, param_12, param_13, param_14, _115, uItem0, uItem0Smplr, uItem1, uItem1Smplr, uItem2, uItem2Smplr, uItem3, uItem3Smplr, uItem4, uItem4Smplr, uItem5, uItem5Smplr);
        float fade = (_115.uReflect * 0.5) * exp(((-3.0) * length(fp.xz)) / fast::max(radius + half_.x, 0.300000011920928955078125));
        acc += ((mirror * fade) * (1.0 - acc.w));
    }
    float4 param_15 = acc;
    fragColor = finish(param_15, _115);
}

fragment flair_orbit_gallery_frag_out flair_orbit_gallery_frag(constant FlairUniforms& _115 [[buffer(0)]], texture2d<float> uItem0 [[texture(1)]], texture2d<float> uItem1 [[texture(2)]], texture2d<float> uItem2 [[texture(3)]], texture2d<float> uItem3 [[texture(4)]], texture2d<float> uItem4 [[texture(5)]], texture2d<float> uItem5 [[texture(6)]], sampler uItem0Smplr [[sampler(1)]], sampler uItem1Smplr [[sampler(2)]], sampler uItem2Smplr [[sampler(3)]], sampler uItem3Smplr [[sampler(4)]], sampler uItem4Smplr [[sampler(5)]], sampler uItem5Smplr [[sampler(6)]], float4 gl_FragCoord [[position]])
{
    flair_orbit_gallery_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1160;
    if (_115.flair_flipY > 0.5)
    {
        _1160 = _115.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1160 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1160);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _115, uItem0, uItem0Smplr, uItem1, uItem1Smplr, uItem2, uItem2Smplr, uItem3, uItem3Smplr, uItem4, uItem4Smplr, uItem5, uItem5Smplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

